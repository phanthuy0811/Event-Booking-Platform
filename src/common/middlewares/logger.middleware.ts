import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";


// Middleware chạy SỚM NHẤT trong pipeline, trước cả Guard --> dùng để ghi log tất cả các HTTP request đến hệ thống 
// Áp dụng global qua AppModule.configure() (xem app.module.ts).
@Injectable()
export class LoggerMiddleware implements NestMiddleware {

    private readonly logger = new Logger('HTTP');

    use(req: Request, res: Response, next: NextFunction) {
        const { method, originalUrl } = req;
        const start = Date.now();

        res.on('finish', () => {
            const { statusCode } = res;
            const duration = Date.now() - start;
            this.logger.log(`[${method}] ${originalUrl} - Status ${statusCode} - ${duration}ms`);
        })

        next();

    }
}