import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { EventsModule } from './events/events.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, EventsModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*')
  }
}
