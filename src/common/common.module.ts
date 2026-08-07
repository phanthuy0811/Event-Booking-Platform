import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaExceptionFilter } from './filters/prisma-exception.filter';
import { TransformResponseInterceptor } from './interceptors/transform-response.interceptor';

// Module này export các guard dùng chung cho toàn app.
@Module({
    providers: [
        JwtAuthGuard,
        RolesGuard,
        {
            provide: APP_FILTER,
            useClass: AllExceptionsFilter,
        },
        {
            provide: APP_FILTER,
            useClass: PrismaExceptionFilter,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: TransformResponseInterceptor,
        }
    ],
    exports: [JwtAuthGuard, RolesGuard],
})
export class CommonModule { }
