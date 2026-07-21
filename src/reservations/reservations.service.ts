import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisLockService } from 'src/redis/redis-lock.service';
import { TicketTypeService } from 'src/ticket-type/ticket-type.service';
import { RESERVATION_EXPIRE_JOB, RESERVATION_EXPIRE_QUEUE } from './reservations.constants';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationStatus } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { AppGateway } from 'src/websocket/websocket.gateway';
import { removeAllListeners } from 'process';

const HOLD_MINUTES = Number(process.env.RESERVATION_HOLD_MINUTES ?? 10); // thời gian giữ chỗ  

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketTypeService: TicketTypeService,
    private readonly redisLockService: RedisLockService,
    private readonly appGateway: AppGateway,
    @InjectQueue(RESERVATION_EXPIRE_QUEUE) private readonly expireQueue: Queue,
  ) { }

  // Tao giu cho
  async create(userId: string, dto: CreateReservationDto) {
    const ticketType = await this.ticketTypeService.findOne(dto.ticketTypeId)

    const now = new Date();
    if (ticketType.salesStart && now < ticketType.salesStart) {
      throw new BadRequestException('Hang ve nay chua mo ban')
    }
    if (ticketType.salesEnd && now > ticketType.salesEnd) {
      throw new BadRequestException('Hang ve nay da dong ban')
    }
    const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);


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
      { jobId: reservation.id, delay: HOLD_MINUTES * 60 * 1000 }
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

      await tx.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.EXPIRED }
      });

      // Cộng trả lại số lượng đã trừ tạm lúc holding 
      await tx.ticketType.update({
        where: { id: reservation.ticketTypeId },
        data: {
          remainingQuantity: { increment: reservation.quantity }
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
    const reservation = await this.findOwnerOrThrow(id, userId);
    return this.releaseReservation(reservation);
  }

  // Dùng khi Payments module thanh toán thất bại
  async releaseInternal(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) throw new NotFoundException('Không tìm thấy giữ chỗ');
    if (reservation.status !== ReservationStatus.HOLDING) {
      return reservation;
    }
    return this.releaseReservation(reservation);
  }

  private async releaseReservation(reservation: {
    id: string;
    ticketTypeId: string;
    quantity: number;
    status: ReservationStatus;
  }) {
    if (reservation.status !== ReservationStatus.HOLDING) {
      throw new BadRequestException(
        'Chỉ có thể hủy giữ chỗ đang ở trạng thái holding',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CANCELLED },
      });
      await tx.ticketType.update({
        where: { id: reservation.ticketTypeId },
        data: { remainingQuantity: { increment: reservation.quantity } },
      });
    });

    const job = await this.expireQueue.getJob(reservation.id);
    if (job) await job.remove();

    await this.broadcastAvailability(reservation.ticketTypeId);

    return { message: 'Đã hủy giữ chỗ' };
  }


  // Dùng nội bộ bởi order module sau khi thanh toán xong 
  // Xác nhận giữ chỗ 
  async confirm(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId }
    })

    if (!reservation) throw new NotFoundException('Khong tim thay giu cho');
    if (reservation.status !== ReservationStatus.HOLDING) {
      throw new BadRequestException('Giu cho nay khong con hieu luc');
    }

    // Không cần trừ thêm remaining nữa vì lúc create đã trừ rồi
    const updated = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CONFIRMED },
    });

    const job = await this.expireQueue.getJob(reservationId);
    if (job) await job.remove();

    return updated;
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

