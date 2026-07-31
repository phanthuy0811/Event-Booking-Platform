import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  create(dto: CreateUserDto) {
    return this.prisma.user.create({
      data: dto
    })
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email }
    })
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id: id }
    })
  }

  async getProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true
      }
    })
    return user
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    await this.getProfile(id);
    return this.prisma.user.update({
      where: { id: id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName })
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true
      }
    })
  }


  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User khong ton tai');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Mat khau hien tai khong chinh xac');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mat khau moi khong duoc trung voi mat khau hien tai');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    return { message: 'Mat khau da duoc thay doi thanh cong' };
  }


  async updateRole(userId: string, role: Role) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException("User khong ton tai");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        role
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true
      }
    })
  }
}
