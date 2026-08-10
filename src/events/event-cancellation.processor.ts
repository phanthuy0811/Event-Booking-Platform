import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EVENT_CANCELLATION_QUEUE } from './event-cancellation.constants';
import { EventCancellationService } from './event-cancellation.service';

@Processor(EVENT_CANCELLATION_QUEUE)
export class EventCancellationProcessor extends WorkerHost {
    private readonly logger = new Logger(EventCancellationProcessor.name);

    constructor(private readonly cancellationService: EventCancellationService) {
        super();
    }

    async process(job: Job<{ eventId: string; correlationId?: string }>) {
        this.logger.log(`[Worker] Xử lý cancellation cho event ${job.data.eventId} | RequestID: ${job.data.correlationId || 'N/A'}`);
        await this.cancellationService.processEventCancellation(job.data.eventId);
    }
}
