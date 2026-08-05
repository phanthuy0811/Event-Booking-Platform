import {
    ArgumentsHost,
    Catch,
    ConflictException,
    ExceptionFilter,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
    catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        switch (exception.code) {
            case 'P2002': {
                const target = (exception.meta?.target as string[])?.join(', ');
                const conflict = new ConflictException(
                    `Dữ liệu bị trùng ở field: ${target ?? 'unknown'}`,
                );
                return response
                    .status(conflict.getStatus())
                    .json(conflict.getResponse());
            }
            case 'P2025': {
                const notFound = new NotFoundException('Không tìm thấy dữ liệu');
                return response
                    .status(notFound.getStatus())
                    .json(notFound.getResponse());
            }
            default: {
                return response.status(400).json({
                    statusCode: 400,
                    message: 'Lỗi dữ liệu không hợp lệ',
                    code: exception.code,
                });
            }
        }
    }
}