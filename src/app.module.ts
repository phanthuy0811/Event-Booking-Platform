import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { TicketTypeModule } from './ticket-type/ticket-type.module';
import { EventsModule } from './events/events.module';
import { ReservationsModule } from './reservations/reservations.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, TicketTypeModule, EventsModule, ReservationsModule, QueueModule, RedisModule, OrdersModule, PaymentsModule, WebsocketModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*')
  }
}
