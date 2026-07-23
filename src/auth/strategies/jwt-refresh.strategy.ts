import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

// Strategy riêng để validate Refresh Token, chỉ được gọi khi user gọi đến api refresh hoặc logout
// Dùng tên 'jwt-refresh' để phân biệt với 'jwt' (access token)
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_REFRESH_SECRET,
            passReqToCallback: true
        })
    }

    async validate(req: Request, payload: { sub: string, eamil: string, role: string }) {
        const rawToken = req.get('Authorization')?.replace('Bearer', '').trim();
        if (!rawToken)
            throw new UnauthorizedException('Refresh token khong hop le');

        return {
            userId: payload.sub,
            email: payload.eamil,
            role: payload.role,
            refreshToken: rawToken
        }
    }

}