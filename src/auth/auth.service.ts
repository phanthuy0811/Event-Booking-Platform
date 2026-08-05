import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt'
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { v4 as uuidv4 } from 'uuid';
import { CacheService } from 'src/redis/cache.service';

@Injectable()
export class AuthService {
  constructor(private readonly userService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly cacheService: CacheService
  ) { }

  async register(dto: RegisterDto) {
    const exitingUser = await this.userService.findByEmail(dto.email)
    if (exitingUser) {
      throw new ConflictException("Email da duoc su dung")
    }

    const password = await bcrypt.hash(dto.password, 10)

    const user = await this.userService.create({
      email: dto.email,
      fullName: dto.fullName,
      passwordHash: password,
      role: Role.GUEST
    })

    return this.BuildTokenPayload(user);

  }

  async login(dto: LoginDto) {
    const exitingUser = await this.userService.findByEmail(dto.email);
    if (!exitingUser) {
      throw new UnauthorizedException("Email hoac mat khau khong chinh xac")
    }

    const isMatch = await bcrypt.compare(dto.password, exitingUser.passwordHash)

    if (!isMatch) {
      throw new UnauthorizedException("Email hoac mat khau khong chinh xac")
    }

    return this.BuildTokenPayload(exitingUser)

  }

  async refreshToken(userId: string, tokenJti: string, refreshToken: string) {
    const token = await this.prisma.refreshToken.findUnique({
      where: { id: tokenJti }
    })

    if (!token || token.isRevoked) {
      await this.revokeAllUserTokens(userId);
      throw new UnauthorizedException("Refresh token khong hop le hoac da bi thu hoi. Vui long dang nhap lai");
    }

    if (token.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token da het han. Vui long dang nhap lai");
    }

    const isMatch = await bcrypt.compare(refreshToken, token.token);
    if (!isMatch) {
      await this.revokeAllUserTokens(userId);
      throw new UnauthorizedException("Refresh token khong hop le. Vui long dang nhap lai");
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenJti },
      data: { isRevoked: true }
    });

    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException("User khong hop le");
    return this.BuildTokenPayload(user);
  }


  async logout(userId: string, tokenJti: string, accessToken?: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        id: tokenJti,
        userId,
        isRevoked: false,
      },
      data: { isRevoked: true },
    });

    if (accessToken) {
      const decoded = this.jwtService.decode(accessToken) as { exp?: number; jti?: string };
      if (decoded?.exp && decoded?.jti) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.cacheService.set(`revoked-access-token:${decoded.jti}`, 'true', ttl);
        }
      }
    }

    return { message: 'Đăng xuất thành công' };
  }



  private async BuildTokenPayload(user: {
    id: string
    email: string
    fullName: string
    role: string
  }) {
    const accessJti = uuidv4();
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: accessJti,
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET as string,
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as any,
    });

    // Dùng uuid làm jwtid để mỗi token là duy nhất
    const refreshJti = uuidv4();
    const refreshToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role, jti: refreshJti },
      {
        secret: process.env.JWT_REFRESH_SECRET as string,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as any,
      },
    );

    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
    const expiresInMs = this.parseExpiry(refreshExpiresIn);
    const expiresAt = new Date(Date.now() + expiresInMs);

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.refreshToken.create({
      data: {
        id: refreshJti,
        token: tokenHash,
        userId: user.id,
        expiresAt,
      },
    });
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  // Thu hồi toàn bộ token của 1 user (khi phát hiện token reuse)
  public async revokeAllUserTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  // Parse chuỗi "7d", "15m", "1h" thành milliseconds
  private parseExpiry(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 7 * 24 * 60 * 60 * 1000; // fallback 7 ngày
    }
  }

}
