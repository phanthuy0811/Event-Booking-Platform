import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrdersService } from 'src/orders/orders.service';
import { UsersService } from 'src/users/users.service';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { MOCK_PAYMENT_JOB, MOCK_PAYMENT_QUEUE } from './payments.constants';
import { Queue } from 'bullmq';
import { PaymentSettlementService } from './payment-settlement.service';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlementService: PaymentSettlementService,
    private readonly configService: ConfigService,
    @InjectQueue(MOCK_PAYMENT_QUEUE) private readonly mockGatewayQueue: Queue,
  ) { }

  // User bấm "Thanh toán" -> tạo Payment PENDING, giả lập gọi cổng thanh toán 
  async initiate(userId: string, orderId: string) {

    const delayMs = this.configService.get<number>('MOCK_PAYMENT_WEBHOOK_DELAY_MS', 5000);

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

    try {
      await this.mockGatewayQueue.add(
        MOCK_PAYMENT_JOB,
        { referenceId, status: 'PAID' as const }, // // demo: luôn giả lập thanh toán thành công
        { delay: delayMs },
      );
    } catch (error) {
      console.error(`[PAYMENT] Không thể thêm job cho referenceId ${referenceId}:`, error);
    }

    return {
      paymentId: payment.id,
      referenceId: payment.referenceId,
      amount: payment.amount,
      status: payment.status,
      message: 'Dang xu ly thanh toan'
    };
  }

  async handleWebhook(referenceId: string, status: 'PAID' | 'FAILED') {
    if (status === 'PAID') {
      const result = await this.settlementService.settleSuccess(referenceId);
      if (result === 'already_processed') {
        return { message: 'Giao dịch đã được xử lý trước đó' };
      }
      return { message: 'Thanh toán thành công' };
    }

    if (status === 'FAILED') {
      await this.settlementService.settleFailure(referenceId);
      return { message: 'Thanh toán thất bại, đơn hàng đã bị hủy' };
    }
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
