import { InjectQueue } from "@nestjs/bullmq";
import { ConflictException, Injectable } from "@nestjs/common";
import { OrderStatus, PaymentStatus, ReservationStatus } from "@prisma/client";
import { Queue } from "bullmq";
import { NotificationsService } from "src/notifications/notifications.service";
import { PrismaService } from "src/prisma/prisma.service";
import { RESERVATION_EXPIRE_QUEUE } from "src/reservations/reservations.constants";
import { ReservationsService } from "src/reservations/reservations.service";

@Injectable()
export class PaymentSettlementService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly reservasionService: ReservationsService,
        private readonly notificationService: NotificationsService,
        @InjectQueue(RESERVATION_EXPIRE_QUEUE) private readonly expireQueue: Queue,
    ) { }

    async settleSuccess(referenceId: string): Promise<'settled' | 'already_processed'> {
        let settledOrderId: string | null = null;
        let settledReservationId: string | null = null;

        const payment = await this.prisma.payment.findUnique({
            where: { referenceId },
            include: { order: true }
        });
        if (!payment || !payment.order) {
            throw new ConflictException("khong tim thay paymen hay order");
        }
        const order = payment.order;

        await this.prisma.$transaction(async (tx) => {
            const paymentResult = await tx.payment.updateMany({
                where: {
                    id: payment.id,
                    status: PaymentStatus.PENDING,
                },
                data: {
                    status: PaymentStatus.PAID,
                    paidAt: new Date(),
                },
            });
            if (paymentResult.count === 0) {
                return;
            }

            const orderResult = await tx.order.updateMany({
                where: {
                    id: payment.orderId,
                    status: OrderStatus.PENDING,
                },
                data: {
                    status: OrderStatus.PAID,

                },
            });

            if (orderResult.count === 0) {
                throw new ConflictException("Don hang khong o trang thai cho thanh toan");
            }

            const reservationResult = await tx.reservation.updateMany({
                where: {
                    userId: order.userId,
                    status: ReservationStatus.HOLDING
                },
                data: {
                    status: ReservationStatus.CONFIRMED
                }
            });
            if (reservationResult.count === 0) {
                throw new ConflictException("Giu cho khong con hieu luc");
            }
            settledOrderId = payment.orderId;
            settledReservationId = order.reservationId;
        });

        if (settledOrderId && settledReservationId) {
            const job = await this.expireQueue.getJob(settledReservationId);
            if (job) await job.remove();

            Promise.all([
                this.notificationService.sendBookingConfirmation(settledOrderId),
                this.notificationService.scheduleEventReminder(settledOrderId)
            ]).catch((err) => {
                console.error(`Lỗi gửi notification cho order ${settledOrderId}:`, err);
            });
            return 'settled';
        }
        return 'already_processed';
    }

    async settleFailure(referenceId: string): Promise<void> {
        const payment = await this.prisma.payment.findUnique({
            where: { referenceId },
            include: { order: { include: { reservation: true } } },
        });
        if (!payment || !payment.order) return;
        let reservationId: string | null = null;
        await this.prisma.$transaction(async (tx) => {
            const paymentResult = await tx.payment.updateMany({
                where: { id: payment.id, status: PaymentStatus.PENDING },
                data: { status: PaymentStatus.FAILED },
            });
            if (paymentResult.count === 0) return;
            await tx.order.updateMany({
                where: { id: payment.orderId, status: OrderStatus.PENDING },
                data: { status: OrderStatus.CANCELLED },
            });
            const reservationResult = await tx.reservation.updateMany({
                where: {
                    id: payment.order!.reservationId,
                    status: ReservationStatus.HOLDING,
                },
                data: { status: ReservationStatus.CANCELLED },
            });
            if (reservationResult.count > 0) {
                await tx.ticketType.update({
                    where: { id: payment.order!.reservation!.ticketTypeId },
                    data: {
                        remainingQuantity: {
                            increment: payment.order!.reservation!.quantity,
                        },
                    },
                });
                reservationId = payment.order!.reservationId;
            }
        });
        if (reservationId) {
            const job = await this.expireQueue.getJob(reservationId);
            if (job) await job.remove();
        }
    }
}