import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class MockWebhookGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();

        const secret = process.env.MOCK_PAYMENT_WEBHOOK_SECRET;

        if (!secret) {
            throw new UnauthorizedException(
                'MOCK_PAYMENT_WEBHOOK_SECRET chưa được cấu hình',
            );
        }

        const incoming = request.headers['x-mock-payment-secret'];

        if (incoming !== secret) {
            throw new UnauthorizedException('Webhook secret không hợp lệ');
        }

        return true;
    }
}
