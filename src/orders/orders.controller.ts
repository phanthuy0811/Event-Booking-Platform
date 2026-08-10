import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CursorPaginationDto } from 'src/common/dto/cursor-pagination.dto';


@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateOrderDto
  ) {
    return this.ordersService.createFromReservation(user.userId, dto.reservationId, dto.reminderMinutesBefore)
  }

  @Get('my')
  findMine(
    @CurrentUser() user: CurrentUserPayload,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.ordersService.findMine(user.userId, pagination)
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload
  ) {
    return this.ordersService.findOneOwned(id, user.userId);
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload
  ) {
    return this.ordersService.cancel(id, user.userId)
  }

}
