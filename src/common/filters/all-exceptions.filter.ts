import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger('ExceptionFilter');

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request & { id?: string, user?: any }>();
        const requestId = request.id;

        const isHttpException = exception instanceof HttpException;
        const status = isHttpException
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        const message = isHttpException
            ? exception.getResponse()
            : 'Đã có lỗi xảy ra, vui lòng thử lại sau';

        const errorLog = {
            requestId,
            userId: request.user?.userId || 'anonymous',
            method: request.method,
            url: request.originalUrl,
            error: message,
            stack: exception instanceof Error ? exception.stack : exception,
        };

        if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(JSON.stringify(errorLog));
        } else {
            this.logger.warn(JSON.stringify(errorLog));
        }

        response.status(status).json({
            success: false,
            statusCode: status,
            requestId,
            message,
        });
    }
}