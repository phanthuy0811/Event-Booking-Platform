import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { TicketTypeService } from './ticket-type.service';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';

@Controller('ticket-type')
export class TicketTypeController {
  constructor(private readonly ticketTypeService: TicketTypeService) { }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  @Post(':eventId/create')
  create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateTicketTypeDto,
    @CurrentUser() user: CurrentUserPayload
  ) {
    return this.ticketTypeService.create(eventId, user.userId, dto)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  @Patch(':eventId/:ticketTypeId/update')
  update(
    @Param('eventId') eventId: string,
    @Param('ticketTypeId') ticketTypeId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateTicketTypeDto
  ) {
    return this.ticketTypeService.update(eventId, ticketTypeId, user.userId, dto)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  @Delete(':eventId/:ticketTypeId/delete')
  delete(
    @Param('eventId') eventId: string,
    @Param('ticketTypeId') ticketTypeId: string,
    @CurrentUser() user: CurrentUserPayload
  ) {
    return this.ticketTypeService.delete(eventId, ticketTypeId, user.userId)
  }

  @Get(':eventId')
  findAllTicketType(
    @Param('eventId') eventId: string
  ) {
    return this.ticketTypeService.findAllTicketType(eventId)
  }

}

