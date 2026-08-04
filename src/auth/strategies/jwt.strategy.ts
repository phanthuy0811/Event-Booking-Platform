import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from "passport-jwt";
import { CacheService } from "src/redis/cache.service";

// Strategy này chạy tự động mỗi khi có request kèm header: Authorization: Bearer <token>

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly cacheService: CacheService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET
        })
    }

    // Sau khi decode được JWT, validate sẽ lấy payload ra
    // và trả vào tham số user trong @UseGuards(AuthGuard('jwt'))
    async validate(payload: { sub: string, email: string, role: string, jti?: string }) {

        if (payload.jti) {
            const isRevoked = await this.cacheService.get(`revoked_access_token:${payload.jti}`);
            if (isRevoked) throw new UnauthorizedException("Đã hết phiên đăng nhập. Vui lòng đăng nhập lại")
        }

        return {
            userId: payload.sub,
            email: payload.email,
            role: payload.role
        }
    }
}