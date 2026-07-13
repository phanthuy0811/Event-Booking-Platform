import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from "passport-jwt";

// Strategy này chạy tự động mỗi khi có request kèm header: Authorization: Bearer <token>

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET
        })
    }

    // Sau khi decode được JWT, validate sẽ lấy payload ra
    // và trả vào tham số user trong @UseGuards(AuthGuard('jwt'))
    async validate(payload: { sub: string, email: string, role: string }) {
        return {
            userId: payload.sub,
            email: payload.email,
            role: payload.role
        }
    }
}