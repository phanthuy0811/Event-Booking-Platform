import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt'
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly userService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
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

  private BuildTokenPayload(user: {
    id: string
    email: string
    fullName: string
    role: string
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role
    }
    const token = this.jwtService.sign(payload)
    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    }
  }

}
