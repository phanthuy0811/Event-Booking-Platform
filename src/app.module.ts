import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { TicketTypeModule } from './ticket-type/ticket-type.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, TicketTypeModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*')
  }
}
