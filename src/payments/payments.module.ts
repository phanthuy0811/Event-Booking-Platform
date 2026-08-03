import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { OrdersModule } from 'src/orders/orders.module';
import { BullModule } from '@nestjs/bullmq';
import { MOCK_PAYMENT_QUEUE } from './payments.constants';
import { PaymentsProcessor } from './payments.processor';
import { ReservationsModule } from 'src/reservations/reservations.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { RESERVATION_EXPIRE_QUEUE } from 'src/reservations/reservations.constants';
import { PaymentSettlementService } from './payment-settlement.service';

@Module({
  imports: [
    OrdersModule,
    ReservationsModule,
    NotificationsModule,
    BullModule.registerQueue(
      { name: MOCK_PAYMENT_QUEUE },
      { name: RESERVATION_EXPIRE_QUEUE },
    )
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsProcessor, PaymentSettlementService],
  exports: [PaymentsService]
})
export class PaymentsModule { }
