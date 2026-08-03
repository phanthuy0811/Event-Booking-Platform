import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { Cron } from "@nestjs/schedule";
import { ReservationStatus } from "@prisma/client";
import { ReservationsService } from "./reservations.service";

@Injectable()
export class ReservationRecoveryService {

    private readonly logger = new Logger(ReservationRecoveryService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly reservationsService: ReservationsService,
    ) { }

    @Cron('*/30 * * * * *')
    async expireOverdueReservations() {
        const reservation = await this.prisma.reservation.findMany({
            where: {
                status: ReservationStatus.HOLDING,
                expiresAt: {
                    lte: new Date()
                }
            },
            select: { id: true },
        });

        if (reservation.length === 0) return;

        const results = await Promise.allSettled(
            reservation.map((r) =>
                this.reservationsService.expireIfStillHolding(r.id)
            )
        )

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                this.logger.error(
                    `[RECOVERY] Không thể huỷ giữ chỗ index ${index}: ${result.reason}`
                )
            }
        });
        this.logger.log(
            `Đã xử lý ${reservation.length} giữ chỗ hết hạn`
        );
    }
}