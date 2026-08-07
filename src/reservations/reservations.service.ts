import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisLockService } from 'src/redis/redis-lock.service';
import { RESERVATION_EXPIRE_JOB, RESERVATION_EXPIRE_QUEUE } from './reservations.constants';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { EventStatus, PrismaClient, ReservationStatus } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { AppGateway } from 'src/websocket/websocket.gateway';
import { ITXClientDenyList } from '@prisma/client/runtime/binary';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisLockService: RedisLockService,
    private readonly appGateway: AppGateway,
    private readonly configService: ConfigService,
    @InjectQueue(RESERVATION_EXPIRE_QUEUE) private readonly expireQueue: Queue,
  ) { }

  // Tao giu cho
  async create(userId: string, dto: CreateReservationDto) {
    const holdMinutes = this.configService.get<number>('RESERVATION_HOLD_MINUTES', 10);
    const ticketType = await this.prisma.ticketType.findFirst({
      where: {
        id: dto.ticketTypeId,
        event: {
          status: EventStatus.PUBLISHED
        },
      },
      include: { event: true }
    })
    if (!ticketType) {
      throw new NotFoundException('Khong tim thay hang ve hoac su kien da ket thuc')
    }

    const now = new Date();

    if (now >= ticketType.event.startTime) {
      throw new BadRequestException("su kien da bat dau");
    }

    if (ticketType.salesStart && now < ticketType.salesStart) {
      throw new BadRequestException('Hang ve nay chua mo ban')
    }
    if (ticketType.salesEnd && now > ticketType.salesEnd) {
      throw new BadRequestException('Hang ve nay da dong ban')
    }
    const expiresAt = new Date(now.getTime() + holdMinutes * 60 * 1000);


    // Lớp bảo vệ đầu tiên: redis lock
    // Mọi request cùng đặt vé cho CÙNG 1 ticketTypeId sẽ phải chờ ở đây,
    // giành nhau đúng 1 key `lock:ticket-type:<id>`. Request nào giành được
    // lock mới được chạy tiếp vào transaction DB bên dưới
    const reservation = await this.redisLockService.withLock(
      `ticket-type:${dto.ticketTypeId}`,
      async () => {

        // Lớp bảo vệ thứ 2 sau redis lock, transaction db để đảm bảo tính toàn vẹn dữ liệu
        return this.prisma.$transaction(async (tx) => {
          const result = await tx.ticketType.updateMany({
            where: {
              id: dto.ticketTypeId,
              remainingQuantity: { gte: dto.quantity }
            },
            data: {
              remainingQuantity: { decrement: dto.quantity },
              version: { increment: 1 },
            }
          });

          if (result.count === 0) {
            throw new BadRequestException(`So ve da dat vuot qua so luong con lai, chi con ${ticketType.remainingQuantity}`);
          }

          return tx.reservation.create({
            data: {
              userId,
              ticketTypeId: dto.ticketTypeId,
              quantity: dto.quantity,
              status: ReservationStatus.HOLDING,
              expiresAt,
            },
          });
        });
      },

      { ttlMs: 5000, retryDelayMs: 100, maxRetries: 30 },
    );

    // Đẩy job delay vào BullMQ: sau HOLD_MINUTES phút, tự động expire
    // nếu vẫn còn HOLDING. jobId = reservation.id để có thể remove job
    // sau này nếu user confirm/cancel sớm hơn thời hạn.
    await this.expireQueue.add(
      RESERVATION_EXPIRE_JOB,
      { reservationId: reservation.id },
      { jobId: reservation.id, delay: holdMinutes * 60 * 1000 }
    )

    // Broadcast cho mọi client đang xem trang chi tiết event này biết
    // remainingQuantity vừa giảm - real-time
    await this.broadcastAvailability(reservation.ticketTypeId)

    return reservation;

  }

  // Được gọi khi hết hạn giữ chỗ nếu user không confirm hoặc cancel 
  async expireIfStillHolding(reservationId: string) {
    const releaseTicketTypeId = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId }
      });

      // Nếu không tồn tại reservation hoặc đã confirm hoặc cancel thì không làm gì cả 
      if (!reservation || reservation.status !== ReservationStatus.HOLDING) {
        return null;
      }

      const transitioned = await tx.reservation.updateMany({
        where: {
          id: reservationId,
          status: ReservationStatus.HOLDING,
        },
        data: { status: ReservationStatus.EXPIRED },
      });

      if (transitioned.count === 0) {
        return null;
      }

      // Cộng trả lại số lượng đã trừ tạm lúc holding 
      await tx.ticketType.update({
        where: { id: reservation.ticketTypeId },
        data: {
          remainingQuantity: { increment: reservation.quantity },
          version: { increment: 1 },
        }
      });

      return reservation.ticketTypeId;

    });

    if (releaseTicketTypeId) {
      await this.broadcastAvailability(releaseTicketTypeId)
    }
  }

  // User chủ động hủy giữ chỗ trước khi hết hạn
  async cancel(id: string, userId: string) {
    await this.findOwnerOrThrow(id, userId);
    return this.cancelByUser(id);
  }

  private async cancelByUser(reservationId: string) {
    const releaseTicketTypeId = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId }
      });
      if (!reservation) return null;
      const transitioned = await tx.reservation.updateMany({
        where: {
          id: reservationId,
          status: ReservationStatus.HOLDING,
        },
        data: { status: ReservationStatus.CANCELLED },
      });
      if (transitioned.count === 0) {
        throw new BadRequestException("Chi co the huy giu cho o trang thai holding");
      }
      await tx.ticketType.update({
        where: { id: reservation.ticketTypeId },
        data: {
          remainingQuantity: { increment: reservation.quantity },
          version: { increment: 1 },
        }
      });

      return reservation.ticketTypeId;
    });

    if (releaseTicketTypeId) {
      const job = await this.expireQueue.getJob(reservationId);
      if (job) await job.remove();
      await this.broadcastAvailability(releaseTicketTypeId);
    }
    return { message: 'Đã hủy giữ chỗ' };
  }

  // Dùng khi Payments module thanh toán thất bại
  async releaseInternal(reservationId: string) {
    const releaseTicketTypeId = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
      });
      if (!reservation) return null;
      const transitioned = await tx.reservation.updateMany({
        where: {
          id: reservationId,
          status: ReservationStatus.HOLDING,
        },
        data: { status: ReservationStatus.CANCELLED },
      });
      if (transitioned.count === 0) return null;
      await tx.ticketType.update({
        where: { id: reservation.ticketTypeId },
        data: {
          remainingQuantity: { increment: reservation.quantity },
          version: { increment: 1 },
        },
      });
      return reservation.ticketTypeId;
    });
    if (releaseTicketTypeId) {
      const job = await this.expireQueue.getJob(reservationId);
      if (job) await job.remove();
      await this.broadcastAvailability(releaseTicketTypeId);
    }
  }

  // Dùng nội bộ bởi order module sau khi thanh toán xong 
  // Xác nhận giữ chỗ 
  async confirm(reservationId: string) {
    const transitioned = await this.prisma.reservation.updateMany({
      where: {
        id: reservationId,
        status: ReservationStatus.HOLDING,
      },
      data: { status: ReservationStatus.CONFIRMED },
    });
    if (transitioned.count === 0) {
      throw new BadRequestException('Giu cho nay khong con hieu luc');
    }
    const job = await this.expireQueue.getJob(reservationId);
    if (job) await job.remove();
    return { reservationId, status: ReservationStatus.CONFIRMED };
  }

  async confirmWithTx(
    reservationId: string,
    tx: Omit<PrismaClient, ITXClientDenyList>,
  ) {
    const result = await tx.reservation.updateMany({
      where: {
        id: reservationId,
        status: ReservationStatus.HOLDING,
      },
      data: { status: ReservationStatus.CONFIRMED },
    });
    return result.count;
  }

  findMine(userId: string) {
    return this.prisma.reservation.findMany({
      where: { userId },
      include: { ticketType: true },
      orderBy: { createdAt: 'desc' }
    })
  }

  private async findOwnerOrThrow(id: string, userId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      throw new NotFoundException("Khong tim thay giu cho")
    }
    if (reservation.userId !== userId) {
      throw new ForbiddenException("Day khong phai giu cho cua ban")
    }

    return reservation;
  }


  // Query lại giá trị MỚI NHẤT
  private async broadcastAvailability(ticketTypeId: string) {
    const ticketType = await this.prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
    })
    if (!ticketType) return;

    this.appGateway.broadcastTicketAvailability(ticketType.eventId, {
      ticketType: ticketType.id,
      remainingQuantity: ticketType.remainingQuantity
    })
  }
}

