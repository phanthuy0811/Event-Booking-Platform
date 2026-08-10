import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { MOCK_PAYMENT_QUEUE } from './payments.constants';
import { PaymentSettlementService } from './payment-settlement.service';

// Worker này CHỈ tồn tại vì đang dùng mock provider. Khi thay bằng
// VNPay/Momo/Stripe thật, XÓA HẲN file này - webhook thật sự sẽ do
// chính cổng thanh toán gọi tới PaymentsController, không cần job giả lập.

@Processor(MOCK_PAYMENT_QUEUE)
export class PaymentsProcessor extends WorkerHost {
    private readonly logger = new Logger(PaymentsProcessor.name);
    constructor(private readonly settlementService: PaymentSettlementService) {
        super();
    }
    async process(job: Job<{ referenceId: string; status: 'PAID' | 'FAILED' }>) {
        const { referenceId, status } = job.data;
        this.logger.log(
            `[Job ${job.id}] attempt=${job.attemptsMade + 1} — settle payment referenceId=${referenceId} status=${status}`
        );
        try {
            if (status === 'PAID') {
                const result = await this.settlementService.settleSuccess(referenceId);
                this.logger.log(`[Job ${job.id}] settleSuccess referenceId=${referenceId} → ${result}`);
            } else {
                await this.settlementService.settleFailure(referenceId);
                this.logger.log(`[Job ${job.id}] settleFailure referenceId=${referenceId} done`);
            }
        } catch (err) {
            this.logger.error(
                `[Job ${job.id}] attempt=${job.attemptsMade + 1} FAILED — referenceId=${referenceId} — ${err.message}`
            );
            if (err?.status === 409) {
                throw new UnrecoverableError(err.message);
            }
            throw err;
        }
    }
}