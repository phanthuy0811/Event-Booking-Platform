import {
    ArgumentsHost,
    Catch,
    ConflictException,
    ExceptionFilter,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

// Nếu ở MỌI bước (Guard, Pipe, Controller...) 
// có lỗi văng ra (Throw Error), luồng xử lý sẽ bị bẻ ngoặt về đây để xử lý trước khi trả về Client

// Bắt riêng PrismaClientKnownRequestError - các mã lỗi (P2002, P2025...)
// được Prisma tài liệu hóa sẵn: https://www.prisma.io/docs/orm/reference/error-reference
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
    catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        switch (exception.code) {
            case 'P2002': {
                // Unique constraint vi phạm, vd trùng email, trùng referenceId payment
                const target = (exception.meta?.target as string[])?.join(', ');
                const conflict = new ConflictException(
                    `Dữ liệu bị trùng ở field: ${target ?? 'unknown'}`,
                );
                return response
                    .status(conflict.getStatus())
                    .json(conflict.getResponse());
            }
            case 'P2025': {
                // Record không tồn tại (vd update/delete 1 id không có thật)
                const notFound = new NotFoundException('Không tìm thấy dữ liệu');
                return response
                    .status(notFound.getStatus())
                    .json(notFound.getResponse());
            }
            default: {
                // Các mã lỗi Prisma khác - trả 400 chung, log lại để debug
                return response.status(400).json({
                    statusCode: 400,
                    message: 'Lỗi dữ liệu không hợp lệ',
                    code: exception.code,
                });
            }
        }
    }
}