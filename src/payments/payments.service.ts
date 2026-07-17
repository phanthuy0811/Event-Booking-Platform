import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrdersService } from 'src/orders/orders.service';
import { UsersService } from 'src/users/users.service';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { MOCK_PAYMENT_JOB, MOCK_PAYMENT_QUEUE } from './payments.constants';
import { Queue } from 'bullmq';

const MOCK_WEBHOOK_DELAY_MS = Number(process.env.MOCK_WEBHOOK_DELAY_MS) || 5000;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrdersService,
    @InjectQueue(MOCK_PAYMENT_QUEUE) private readonly mockGatewayQueue: Queue,
  ) { }

  // User bấm "Thanh toán" -> tạo Payment PENDING, giả lập gọi cổng thanh toán 
  async initiate(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId }
    })

    if (!order) {
      throw new NotFoundException('Khong tim thay don hang')
    };
    if (order.userId !== userId) {
      throw new ForbiddenException('Day khong phai don hang cua ban')
    };
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Don hang nay khong o trang thai cho thanh toan')
    };

    const existingPayment = await this.prisma.payment.findUnique({
      where: { orderId }
    });
    if (existingPayment) {
      throw new BadRequestException('Don hang nay da co giao dich thanh toan')
    };

    // referenceId đóng vai trò mã giao dịch từ cổng thanh toán - PHẢI unique
    // (chính là cột @unique trong schema) để đảm bảo idempotency ở webhook
    const referenceId = randomUUID();
    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        provider: 'mock',
        referenceId,
        amount: order.totalAmount,
        status: PaymentStatus.PENDING,
      },
    });

    await this.mockGatewayQueue.add(
      MOCK_PAYMENT_JOB,
      { referenceId, status: 'PAID' as const }, // // demo: luôn giả lập thanh toán thành công
      { delay: MOCK_WEBHOOK_DELAY_MS },
    );

    return {
      paymentId: payment.id,
      referenceId: payment.referenceId,
      amount: payment.amount,
      status: payment.status,
      message: 'Dang xu ly thanh toan'
    };
  }

  async handleWebhook(referenceId: string, status: 'PAID' | 'FAILED') {
    const payment = await this.prisma.payment.findUnique({
      where: { referenceId }
    })
    if (!payment) {
      throw new NotFoundException('Khong tim thay giao dich thanh toan')
    }
    if (payment.status !== PaymentStatus.PENDING) {
      return {
        message: 'Giao dich da duoc xu ly truoc do',
        status: payment.status
      }
    };

    if (status === 'FAILED') {
      await this.prisma.payment.update({
        where: { referenceId },
        data: {
          status: PaymentStatus.FAILED,
        },
      });
      await this.orderService.cancelInternal(payment.orderId);
      return { message: 'Thanh toan that bai, don hang da bi huy' }
    };

    // status === 'PAID'
    try {
      // markAsPaid() bên trong sẽ gọi reservationsService.confirm() -
      // hàm này throw lỗi nếu reservation không còn HOLDING
      await this.orderService.markAsPaid(payment.orderId);
    } catch (err) {

      // Thanh toán về mặt tiền thì "thành công", nhưng vé không còn giữ được
      // nữa -> coi như giao dịch thất bại ở phía hệ thống mình, phải hủy đơn.
      await this.prisma.payment.update({
        where: { referenceId },
        data: {
          status: PaymentStatus.FAILED,
        },
      });
      await this.orderService.cancelInternal(payment.orderId);
      return {
        message: 'Giu cho da het han truoc khi thanh toan xong, don hang da bi huy'
      }
    }
    await this.prisma.payment.update({
      where: { referenceId },
      data: { status: PaymentStatus.PAID, paidAt: new Date() }
    });
    return { message: 'Thanh toan thanh cong' };
  }

  async findByOrder(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.userId !== userId) {
      throw new ForbiddenException('Đây không phải đơn hàng của bạn');
    }
    return this.prisma.payment.findUnique({ where: { orderId } });
  }

}
