import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';
import { CursorPaginationDto } from 'src/common/dto/cursor-pagination.dto';


@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) { }

  @Get('my')
  findMine(
    @CurrentUser() user: CurrentUserPayload,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.notificationsService.findMine(user.userId, pagination);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.notificationsService.markAsRead(id, user.userId);
  }
}
