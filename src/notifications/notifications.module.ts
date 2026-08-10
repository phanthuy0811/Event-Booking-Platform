import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { BullModule } from '@nestjs/bullmq';
import { NOTIFICATION_REMINDER_QUEUE } from './notifications.constants';
import { WebsocketModule } from 'src/websocket/websocket.module';
import { MailerService } from './mailer.service';
import { NotificationsProcessor } from './notifications.processor';
import { MailTemplateService } from './mail-template.service';

@Module({
  imports: [
    WebsocketModule, // cần AppGateway để push notification realtime
    BullModule.registerQueue({ name: NOTIFICATION_REMINDER_QUEUE }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsProcessor, MailerService, MailTemplateService],
  exports: [NotificationsService]
})
export class NotificationsModule { }
