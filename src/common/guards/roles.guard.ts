// kiem tra role sau khi dang nhap

import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";


// Guard này PHẢI chạy sau JwtAuthGuard (cần request.user đã được gắn sẵn)
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // Route không gắn @Roles() -> ai đăng nhập cũng vào được
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();
        // user ở đây chính là object trả về từ hàm validate của JwtStrategy
        return requiredRoles.includes(user?.role);
    }
}
