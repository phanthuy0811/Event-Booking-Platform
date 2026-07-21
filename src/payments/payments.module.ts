import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { OrdersModule } from 'src/orders/orders.module';
import { BullModule } from '@nestjs/bullmq';
import { MOCK_PAYMENT_QUEUE } from './payments.constants';
import { PaymentsProcessor } from './payments.processor';

@Module({
  imports: [
    OrdersModule,
    BullModule.registerQueue({
      name: MOCK_PAYMENT_QUEUE
    })
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsProcessor],
  exports: [PaymentsService]
})
export class PaymentsModule { }
