import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

  async updateProfile(id: string, dto: UpdateUserDto) {
    await this.getProfile(id);
    return this.prisma.user.update({
      where: { id: id },
      data: dto,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true
      }
    })
  }
}
