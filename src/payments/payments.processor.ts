import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PaymentsService } from './payments.service';
import { MOCK_PAYMENT_QUEUE } from './payments.constants';

// Worker này CHỈ tồn tại vì đang dùng mock provider. Khi thay bằng
// VNPay/Momo/Stripe thật, XÓA HẲN file này - webhook thật sự sẽ do
// chính cổng thanh toán gọi tới PaymentsController, không cần job giả lập.
@Processor(MOCK_PAYMENT_QUEUE)
export class PaymentsProcessor extends WorkerHost {
    private readonly logger = new Logger(PaymentsProcessor.name);

    constructor(private readonly paymentsService: PaymentsService) {
        super();
    }

    async process(job: Job<{ referenceId: string; status: 'PAID' | 'FAILED' }>) {
        this.logger.log(
            `[MOCK GATEWAY] Giả lập webhook cho referenceId ${job.data.referenceId}`,
        );
        await this.paymentsService.handleWebhook(job.data.referenceId, job.data.status);
    }
}