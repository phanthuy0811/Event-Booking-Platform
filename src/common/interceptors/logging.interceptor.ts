import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const ctx = context.switchToHttp();
        const req = ctx.getRequest();
        const res = ctx.getResponse();

        const { method, originalUrl, id } = req;
        const userId = req.user?.userId || 'anonymous';
        const startTime = Date.now();

        return next.handle().pipe(
            tap(() => {
                const duration = Date.now() - startTime;

                // Log dạng JSON có cấu trúc
                const logData = {
                    requestId: id,
                    method: method,
                    route: originalUrl,
                    statusCode: res.statusCode,
                    durationMs: duration,
                    userId: userId,
                };

                this.logger.log(JSON.stringify(logData));
            }),
        );
    }
}
