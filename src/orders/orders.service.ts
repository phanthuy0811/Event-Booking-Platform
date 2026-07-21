import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReservationsService } from 'src/reservations/reservations.service';
import { OrderStatus, ReservationStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationService: ReservationsService
  ) { }

  // Tạo order từ 1 Reservation đang holding 
  async createFromReservation(userId: string, reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { ticketType: true }
    })
    if (!reservation) {
      throw new NotFoundException('khong tim thay giu cho')
    }
    if (reservation.userId !== userId) {
      throw new ForbiddenException('Day khong phai giu cho cua ban')
    }
    if (reservation.status !== ReservationStatus.HOLDING) {
      throw new BadRequestException('Giu cho nay khong con hieu luc')
    }

    const exitingOrder = await this.prisma.order.findUnique({
      where: {
        reservationId: reservationId
      }
    })
    if (exitingOrder) {
      throw new BadRequestException('Giu cho nay da duoc tao don hang roi')
    }

    // Chốt giá TẠI THỜI ĐIỂM MUA - nếu sau này organizer đổi giá vé,
    // đơn hàng cũ không bị ảnh hưởng
    const unitPrice = reservation.ticketType.price;
    const totalAmount = Number(unitPrice) * reservation.quantity;
    return this.prisma.order.create({
      data: {
        userId: userId,
        reservationId: reservationId,
        totalAmount: totalAmount,
        status: OrderStatus.PENDING,
        items: {
          create: {
            ticketTypeId: reservation.ticketTypeId,
            quantity: reservation.quantity,
            unitPrice: unitPrice
          }
        }
      },
      include: { items: true }
    });
  }

  findMine(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: { include: { ticketType: true } }, payment: true, reservation: true },
      orderBy: { createdAt: 'desc' }
    })
  }

  async findOneOwned(id: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { ticketType: true } }, payment: true, reservation: true }
    });

    if (!order) throw new NotFoundException('Khong tim thay don hang');
    if (order.userId !== userId) throw new ForbiddenException('Day khong phai don hang cua ban');
    return order;
  }

  // User chủ động hủy đơn khi CHƯA thanh toán - nhả lại reservation
  async cancel(id: string, userId: string) {
    const order = await this.findOneOwned(id, userId);
    return this.cancelOrder(order.id, order.reservationId, order.status);
  }

  // Dùng khi thanh toán thất bại hoặc reservation đã hết hạn trước khi thanh toán xong kịp
  async cancelInternal(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.status !== OrderStatus.PENDING) {
      return order;
    }
    return this.cancelOrder(order.id, order.reservationId, order.status);
  }

  private async cancelOrder(
    orderId: string,
    reservationId: string,
    currentStatus: OrderStatus,
  ) {
    if (currentStatus !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể hủy đơn hàng đang ở trạng thái chờ thanh toán',
      );
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });

    await this.reservationService.releaseInternal(reservationId);

    return { message: 'Đã hủy đơn hàng' };
  }



  // Dùng để payment module gọi sau khi xác nhận thanh toán thành công qua webhook
  async markAsPaid(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) throw new NotFoundException('Khong tim thay don hang');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Don hang khong o trang thai cho thanh toan')
    }

    // Confirm reservation trước (đổi HOLDING -> CONFIRMED, hủy job auto-expire)
    await this.reservationService.confirm(order.reservationId);
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PAID }
    })
  }
}

