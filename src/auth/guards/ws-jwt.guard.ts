import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { CacheService } from 'src/redis/cache.service';

@Injectable()
export class WsJwtGuard implements CanActivate {
    private readonly logger = new Logger(WsJwtGuard.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly cacheService: CacheService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const client: Socket = context.switchToWs().getClient();

        // BẢO MẬT: Chỉ lấy token từ handshake.auth, KHÔNG lấy từ query
        const token = client.handshake.auth?.token;

        if (!token) {
            throw new WsException('Vui lòng cung cấp token');
        }

        try {
            const payload = this.jwtService.verify(token, {
                secret: process.env.JWT_SECRET,
            });

            // CHECK REVOCATION: Kiểm tra xem token này đã bị đăng xuất chưa (dùng chung CacheService)
            if (payload.jti) {
                const isRevoked = await this.cacheService.get(`revoked-access-token:${payload.jti}`);
                if (isRevoked) {
                    throw new WsException('Token đã bị thu hồi');
                }
            }

            // Gán thông tin user vào socket data để các hàm khác sử dụng
            client.data.userId = payload.sub;
            client.data.user = payload;

            return true;
        } catch (err) {
            this.logger.warn(`WsJwtGuard failed: ${err.message}`);
            throw new WsException('Token không hợp lệ');
        }
    }
}
