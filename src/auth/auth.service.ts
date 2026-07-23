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

  async refreshToken(userId: string, refreshToken: string) {
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const token = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() }
      }
    })
    let validToken: any = null;
    for (const t of token) {
      const isMatch = await bcrypt.compare(refreshToken, t.token);
      if (isMatch) {
        validToken = t;
        break;
      }
    }
    if (!validToken) {
      await this.revokeAllUserTokens(userId);
      throw new UnauthorizedException("Refresh token khong hop le hoac da bi thu hoi. Vui long dang nhap lai");
    }

    // thu hồi token cũ để tránh bị đánh cắp refresh token
    await this.prisma.refreshToken.update({
      where: { id: validToken.id },
      data: { isRevoked: true }
    })

    // Lấy thông tin user để tạo token mới 
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException('User khong ton tai');
    return this.BuildTokenPayload(user);

  }

  async logout(userId: string, refreshToken: string, accessToken?: string) {
    // thu hồi refresh token 
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        isRevoked: false,
      },
    });
    for (const t of tokens) {
      const isMatch = await bcrypt.compare(refreshToken, t.token);
      if (isMatch) {
        await this.prisma.refreshToken.update({
          where: { id: t.id },
          data: { isRevoked: true },
        });
        break;
      }
    }

    // Thêm access token vào blacklist khi logout 
    if (accessToken) {
      const decoded = this.jwtService.decode(accessToken) as { exp?: number };
      if (decoded?.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.cacheService.set(`blacklist:${accessToken}`, 'true', ttl);
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
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET as string,
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as any,
    });

    // Dùng uuid làm jwtid để mỗi token là duy nhất
    const jti = uuidv4();
    const refreshToken = this.jwtService.sign(
      { ...payload, jti },
      {
        secret: process.env.JWT_REFRESH_SECRET as string,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as any,
      },
    );

    // Lưu HASH của refresh token xuống DB (không lưu plaintext)
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // khớp với 7d
    await this.prisma.refreshToken.create({
      data: {
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
  private async revokeAllUserTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

}
