import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_REMINDER_QUEUE } from './notifications.constants';

@Processor(NOTIFICATION_REMINDER_QUEUE)
export class NotificationsProcessor extends WorkerHost {
    private readonly logger = new Logger(NotificationsProcessor.name);

    constructor(private readonly notificationsService: NotificationsService) {
        super();
    }

    async process(job: Job<{ orderId: string }>) {
        this.logger.log(`Gửi nhắc lịch cho order ${job.data.orderId}`);
        await this.notificationsService.sendEventReminder(job.data.orderId);
    }
}