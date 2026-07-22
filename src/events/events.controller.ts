import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { EventsService } from './events.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UpdateEventDto } from './dto/update-event.dto';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { findEventsQueryDto } from './dto/find-events-query.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) { }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  @Post('create')
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateEventDto
  ) {
    return this.eventsService.create(user.userId, dto)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  @Patch(':id/update')
  update(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateEventDto
  ) {
    return this.eventsService.update(id, user.userId, dto)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload
  ) {
    return this.eventsService.cancel(id, user)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  @Patch(':id/submit')
  submitForApproval(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload
  ) {
    return this.eventsService.submitForApproval(id, user.userId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/approval')
  approvalEvent(
    @Param('id') id: string
  ) {
    return this.eventsService.approvalEvent(id)
  }

  @Get('publish')
  findAllEventPublish(@Query() query: findEventsQueryDto) {
    return this.eventsService.findAllEventPublished(query)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  @Get('organizer')
  findAllByOrganizer(
    @CurrentUser() user: CurrentUserPayload
  ) {
    return this.eventsService.findAllEventByOrganizer(user.userId)
  }

}

