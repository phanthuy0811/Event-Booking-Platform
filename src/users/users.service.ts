import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

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
}
