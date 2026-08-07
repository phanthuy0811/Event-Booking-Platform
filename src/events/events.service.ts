import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventStatus } from '@prisma/client';
import { findEventsQueryDto } from './dto/find-events-query.dto';
import { BadRequestException } from '@nestjs/common';
import { EventCancellationService } from './event-cancellation.service';
import { EventsCacheService } from './events-cache.service';


@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evenCacheService: EventsCacheService,
    private readonly cancellationService: EventCancellationService,
  ) { }

  create(organizerId: string, dto: CreateEventDto) {

    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (end <= start) {
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
    }

    return this.prisma.event.create({
      data: {
        ...dto,
        startTime: start,
        endTime: end,
        organizerId,
        status: EventStatus.DRAFT
      }
    })
  }

  async update(id: string, organizerId: string, dto: UpdateEventDto) {
    const event = await this.searchEventByOrganizer(id, organizerId)

    const start = dto.startTime ? new Date(dto.startTime) : event.startTime;
    const end = dto.endTime ? new Date(dto.endTime) : event.endTime;

    if (end <= start) {
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
    }

    const updated = await this.prisma.event.update({
      where: { id: id },
      data: {
        ...dto,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined
      }
    });
    // Event đang PUBLISHED mà bị sửa (đổi giờ, đổi tên...) -> cache cũ sai,
    // phải xóa ngay. Event đang DRAFT thì xóa cũng vô hại (không có gì để xóa).
    if (event.status === EventStatus.PUBLISHED) {
      await this.evenCacheService.invalidatePublishedEvents();
    }

    return updated;
  }

  async cancel(id: string, currentUser: { userId: string; role: string }) {
    return this.cancellationService.cancelEvent(id, currentUser);
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
    const updated = await this.prisma.event.update({
      where: { id: id },
      data: {
        status: EventStatus.PUBLISHED
      }
    });
    // Event VỪA xuất hiện trong danh sách public -> mọi cache list hiện tại
    // đều đang thiếu event này, phải xóa để lần gọi tiếp theo query lại DB
    await this.evenCacheService.invalidatePublishedEvents();

    return updated;
  }

  async findOnePublished(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id, status: EventStatus.PUBLISHED },
      include: { ticketTypes: true }
    })
    if (!event) throw new NotFoundException('Không tìm thấy sự kiện')
    return event
  }

  //Danh sách các event publish
  async findAllEventPublished(query: findEventsQueryDto) {

    const cached = await this.evenCacheService.getPublishedEvents(query);
    if (cached) return cached;

    const search = query.search?.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 100);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const events = await this.prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        location: query.location ? { contains: query.location.trim(), mode: 'insensitive' } : undefined, // mode insensitive: khong phan biet hoa thuong
        category: query.category ?? undefined,
        title: search ? { contains: search, mode: 'insensitive' } : undefined
      },
      include: { ticketTypes: true },
      orderBy: { startTime: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    await this.evenCacheService.setPublishedEvents(query, events);
    return events;
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
