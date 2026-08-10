import { Processor, WorkerHost } from "@nestjs/bullmq";
import { RESERVATION_EXPIRE_QUEUE } from "./reservations.constants";
import { Logger } from "@nestjs/common";
import { ReservationsService } from "./reservations.service";
import { Job } from "bullmq";

// @Processor gắn worker này vào đúng queue đã khai báo ở ReservationsModule.
// Job được add() lúc ReservationsService.create() với delay = HOLD_MINUTES,
// nên hàm process() dưới đây chỉ THỰC SỰ chạy khi tới đúng thời điểm hết hạn.
@Processor(RESERVATION_EXPIRE_QUEUE)
export class ReservationProcessor extends WorkerHost {
    private readonly logger = new Logger(ReservationProcessor.name);
    constructor(private readonly reservationService: ReservationsService) {
        super();
    }
    async process(job: Job<{ reservationId: string; correlationId?: string }>) {
        const { reservationId, correlationId } = job.data;
        this.logger.log(
            `[Job ${job.id}] attempt=${job.attemptsMade + 1} — expire reservation ${reservationId} | RequestID: ${correlationId || 'N/A'}`
        );
        try {
            await this.reservationService.expireIfStillHolding(reservationId);
            this.logger.log(`[Job ${job.id}] Expire reservation ${reservationId} thành công`);
        } catch (err) {
            this.logger.error(
                `[Job ${job.id}] attempt=${job.attemptsMade + 1} FAILED — reservationId=${reservationId} — ${err.message}`
            );

            throw err;
        }
    }
}