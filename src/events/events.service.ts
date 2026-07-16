import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventStatus } from '@prisma/client';
import { findEventsQueryDto } from './dto/find-events-query.dto';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) { }

  create(organizerId: string, dto: CreateEventDto) {
    return this.prisma.event.create({
      data: {
        ...dto,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        organizerId,
        status: "DRAFT"
      }
    })
  }

  async update(id: string, organizerId: string, dto: UpdateEventDto) {
    await this.searchEventByOrganizer(id, organizerId)
    return this.prisma.event.update({
      where: { id: id },
      data: {
        ...dto,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined
      }
    })
  }

  async cancel(id: string, organizerId: string) {
    await this.searchEventByOrganizer(id, organizerId)
    return this.prisma.event.update({
      where: { id: id },
      data: {
        status: EventStatus.CANCELLED
      }
    })
  }

  // Organizer gửi event để admin duyệt
  async submitForApproval(id: string, organizerId: string) {
    const event = await this.searchEventByOrganizer(id, organizerId)
    if (event.status !== EventStatus.DRAFT) {
      throw new BadRequestException("Event khong phai o trang thai draft")
    }
    return this.prisma.event.update({
      where: { id: id },
      data: {
        status: EventStatus.PENDING_APPROVAL
      }
    })
  }

  // admin duyệt event
  async approvalEvent(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: id }
    })
    if (!event) {
      throw new NotFoundException("Khong tim thay su kien")
    }
    return this.prisma.event.update({
      where: { id: id },
      data: {
        status: EventStatus.PUBLISHED
      }
    })
  }

  //Danh sách các event publish
  async findAllEventPublished(query: findEventsQueryDto) {
    return this.prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        location: query.location ? { contains: query.location, mode: 'insensitive' } : undefined, // mode insensitive: khong phan biet hoa thuong
        category: query.category ?? undefined,
        title: query.search ? { contains: query.search, mode: 'insensitive' } : undefined
      }
    })
  }

  // Danh sách các event của organizer
  async findAllEventByOrganizer(organizerId: string) {
    return this.prisma.event.findMany({
      where: { organizerId: organizerId },
      include: { ticketTypes: true },
      orderBy: { createdAt: 'desc' }
    })
  }

  async searchEventByOrganizer(id: string, organizerId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: id }
    })
    if (!event) {
      throw new NotFoundException("Khong tim thay su kien")
    }
    if (event.organizerId !== organizerId) {
      throw new ForbiddenException("Ban khong phai chu su kien nay")
    }
    return event;
  }

}
