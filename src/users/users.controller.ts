import { Controller, Get, Post, Body, Patch, Param, Delete, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    async getProfile(@CurrentUser() user: CurrentUserPayload) {
        return this.usersService.getProfile(user.userId)
    }

    @Patch('me')
    @UseGuards(JwtAuthGuard)
    async updateProfile(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateUserDto) {
        return this.usersService.updateProfile(user.userId, dto)
    }
}
