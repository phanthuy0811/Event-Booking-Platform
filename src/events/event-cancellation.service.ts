import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { EVENT_CANCELLATION_JOB, EVENT_CANCELLATION_QUEUE } from "./event-cancellation.constants";
import { Queue } from "bullmq";
import { PrismaService } from "src/prisma/prisma.service";
import { EventStatus, OrderStatus, PaymentStatus, ReservationStatus } from "@prisma/client";
import { CacheService } from "src/redis/cache.service";
import { text } from "stream/consumers";
import { NotificationsService } from "src/notifications/notifications.service";

const PUBLISHED_EVENTS_CACHE_PREFIX = 'events:published:';
const NOTIFICATION_REMINDER_JOB_PREFIX = 'reminder-';

@Injectable()
export class EventCancellationService {
    private readonly logger = new Logger(EventCancellationService.name);
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly notificationsService: NotificationsService,
        @InjectQueue(EVENT_CANCELLATION_QUEUE) private readonly cancellationQueue: Queue,
        @InjectQueue('notification-reminder') private readonly reminderQueue: Queue,
    ) { }

    async cancelEvent(eventId: string, users: { userId: string, role: string }) {
        const event = await this.prisma.event.findUnique({
            where: { id: eventId }
        });

        if (!event) throw new NotFoundException("Khong tim thay su kien");

        const isOwner = event.organizerId === users.userId;
        const isAdmin = users.role === 'ADMIN';
        if (!isOwner && !isAdmin) throw new ForbiddenException("Ban khong co quyen huy su kien nay");

        if (event.status === EventStatus.CANCELLED) {
            return { message: "Su kien da duoc huy truoc do" };
        }

        await this.prisma.event.update({
            where: { id: eventId },
            data: { status: EventStatus.CANCELLED }
        });

        await this.cacheService.delByPrefix(PUBLISHED_EVENTS_CACHE_PREFIX)

        try {
            await this.cancellationQueue.add(
                EVENT_CANCELLATION_JOB,
                { eventId },
                {
                    jobId: `event-cancel-${eventId}`,
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 5000 },
                }
            )
        } catch (err) {
            this.logger.error('Khong the huy su kien, hay thu lai sau', err);
            throw err;
        }
        return { message: "Huy su kien thanh cong" };
    }

    async processEventCancellation(eventId: string) {
        await this.cancelHoldingReservations(eventId);
        await this.cancelPendingOrders(eventId);
        await this.refundPaidOrders(eventId);
        await this.removeReminderJobs(eventId);
        await this.sendCancellationNotifications(eventId);
    }

    // Huy cac giu cho khi su kien bi huy
    private async cancelHoldingReservations(eventId: string) {
        const reservations = await this.prisma.reservation.findMany({
            where: {
                ticketType: {
                    event: {
                        id: eventId,
                        status: EventStatus.CANCELLED,
                    }
                },
                status: ReservationStatus.HOLDING,
            },
            select: { id: true, ticketTypeId: true, quantity: true },
        });

        if (reservations.length === 0) return;

        const results = await Promise.allSettled(
            reservations.map((r) => {
                this.prisma.$transaction(async (tx) => {
                    const transitioned = await tx.reservation.updateMany({
                        where: { id: r.id, status: ReservationStatus.HOLDING },
                        data: { status: ReservationStatus.CANCELLED }
                    });
                    if (transitioned.count === 0) return;

                    await tx.ticketType.update({
                        where: { id: r.ticketTypeId },
                        data: { remainingQuantity: { increment: r.quantity } },
                    })
                })
            })
        )
        results.forEach((result, i) => {
            if (result.status === 'rejected') {
                this.logger.error(
                    `[Cancellation] Lỗi cancel reservation ${reservations[i].id}:`,
                    result.reason,
                );
            };
        });

        this.logger.log(
            `[Cancellation] Đã cancel ${reservations.length} holding reservation`,
        );
    }

    // huy cac order dang pending
    private async cancelPendingOrders(eventId: string) {
        const result = await this.prisma.order.updateMany({
            where: {
                status: OrderStatus.PENDING,
                reservation: { ticketType: { eventId } },
            },
            data: { status: OrderStatus.CANCELLED },
        });
        this.logger.log(
            `[Cancellation] Đã cancel ${result.count} pending order`,
        );
    }

    // refund tat ca paid order
    private async refundPaidOrders(eventId: string) {
        const paidOrders = await this.prisma.order.findMany({
            where: {
                status: OrderStatus.PAID,
                reservation: { ticketType: { eventId } },
            },
            select: { id: true, userId: true },
        });

        if (paidOrders.length === 0) return;
        const results = await Promise.allSettled(
            paidOrders.map(order => {
                this.prisma.$transaction(async (tx) => {
                    const orderResult = await tx.order.updateMany({
                        where: { id: order.id, status: OrderStatus.PAID },
                        data: { status: OrderStatus.REFUNDED },
                    });

                    if (orderResult.count === 0) return;

                    await tx.payment.updateMany({
                        where: { orderId: order.id },
                        data: { status: PaymentStatus.REFUNDED }
                    })
                })
            })
        );
        results.forEach((result, i) => {
            if (result.status === 'rejected') {
                this.logger.error(
                    `[Cancellation] Lỗi refund order ${paidOrders[i].id}:`,
                    result.reason,
                );
            }
        });
        this.logger.log(
            `[Cancellation] Đã refund ${paidOrders.length} paid order`,
        );
    }

    // xóa các job chưa kịp bắn đi
    private async removeReminderJobs(eventId: string) {
        const paidOrders = await this.prisma.order.findMany({
            where: {
                reservation: { ticketType: { eventId } },
            },
            select: { id: true },
        });
        const results = await Promise.allSettled(
            paidOrders.map(async (order) => {
                const jobId = `${NOTIFICATION_REMINDER_JOB_PREFIX}${order.id}`;
                const job = await this.reminderQueue.getJob(jobId);
                if (job) await job.remove();
            }),
        );
        const removed = results.filter((r) => r.status === 'fulfilled').length;
        this.logger.log(`[Cancellation] Đã xóa ${removed} reminder job`);
    }

    // Gửi thông báo cho toàn bộ user đã đặt vé bị hủy này 
    private async sendCancellationNotifications(eventId: string) {
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            select: { title: true },
        });
        if (!event) return;
        const affectedUsers = await this.prisma.reservation.findMany({
            where: {
                ticketType: { eventId },
                status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CANCELLED] },
            },
            select: { userId: true },
            distinct: ['userId'],
        });
        if (affectedUsers.length === 0) return;
        Promise.allSettled(
            affectedUsers.map((u) =>
                this.notificationsService.sendEventCancellationNotification(
                    u.userId,
                    event.title,
                ),
            ),
        ).catch((err) => {
            this.logger.error(
                `[Cancellation] Lỗi gửi notification cho event ${eventId}:`,
                err,
            );
        });
    }
}