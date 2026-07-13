import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Response } from 'express';

// Là chiếc lưới cuối cùng. Nếu lỗi không phải do Prisma,
// filter này sẽ bắt mọi lỗi chưa được xử lý, 
// format cấu trúc json trả về lỗi ({ success: false, statusCode, message })
// và ghi log chi tiết nếu là lỗi 500
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

        // Lỗi không xác định (500) thì log đầy đủ để debug,
        // lỗi nghiệp vụ bình thường (400/401/403/404...) thì không cần log ồn
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