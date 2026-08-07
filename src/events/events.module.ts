import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { AuthModule } from 'src/auth/auth.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { BullModule } from '@nestjs/bullmq';
import { EVENT_CANCELLATION_QUEUE } from './event-cancellation.constants';
import { NOTIFICATION_REMINDER_QUEUE } from 'src/notifications/notifications.constants';
import { EventCancellationProcessor } from './event-cancellation.processor';
import { EventCancellationService } from './event-cancellation.service';
import { EventsCacheService } from './events-cache.service';


@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    BullModule.registerQueue(
      { name: EVENT_CANCELLATION_QUEUE },
      { name: NOTIFICATION_REMINDER_QUEUE },
    )
  ],
  controllers: [EventsController],
  providers: [EventsService, EventCancellationProcessor, EventCancellationService, EventsCacheService],
})
export class EventsModule { }
