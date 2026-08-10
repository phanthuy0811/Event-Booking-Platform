import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { CursorPaginationDto } from 'src/common/dto/cursor-pagination.dto';

@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) { }

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateReservationDto
  ) {
    return this.reservationsService.create(user.userId, dto, user.requestId)
  }

  @Get('my')
  findMine(
    @CurrentUser() user: CurrentUserPayload,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.reservationsService.findMine(user.userId, pagination)
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.reservationsService.cancel(id, user.userId)
  }
}
