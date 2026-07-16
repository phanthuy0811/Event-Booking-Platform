import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { TicketTypeModule } from 'src/ticket-type/ticket-type.module';
import { BullModule } from '@nestjs/bullmq';
import { RESERVATION_EXPIRE_QUEUE } from './reservations.constants';
import { ReservationProcessor } from './Reservations.processor';

@Module({
  imports: [
    TicketTypeModule,
    BullModule.registerQueue({ name: RESERVATION_EXPIRE_QUEUE }),
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationProcessor],
  exports: [ReservationsService]
})
export class ReservationsModule { }
