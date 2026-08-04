import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger('ExceptionFilter');

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        const isHttpException = exception instanceof HttpException;
        const status = isHttpException
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        const message = isHttpException
            ? exception.getResponse()
            : 'Đã có lỗi xảy ra, vui lòng thử lại sau';

        if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(exception instanceof Error ? exception.stack : exception);
        }

        response.status(status).json({
            success: false,
            statusCode: status,
            message,
        });
    }
}