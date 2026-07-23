// bat buoc dang nhap
// kiểm tra xem có truyển token không, nếu không báo lỗi 401 

import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CacheService } from "src/redis/cache.service";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private readonly cacheService: CacheService) {
        super();
    }

    // Kiểm tra token có nằm trong blacklist không
    async canActivate(context: ExecutionContext): Promise<boolean> {

        const isValid = await super.canActivate(context) as boolean;
        if (!isValid) return false;

        const request = context.switchToHttp().getRequest();
        const authHeader: string = request.headers['authorization'] ?? '';
        const token = authHeader.replace('Bearer ', '').trim();

        const isBlacklisted = await this.cacheService.get(`blacklist:${token}`);
        if (isBlacklisted) {
            throw new UnauthorizedException('Đã hết phiên đăng nhập. Vui lòng đăng nhập lại.');
        }
        return true;
    }
}