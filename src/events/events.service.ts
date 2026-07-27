import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventStatus } from '@prisma/client';
import { findEventsQueryDto } from './dto/find-events-query.dto';
import { BadRequestException } from '@nestjs/common';
import { CacheService } from 'src/redis/cache.service';


// Mọi cache key của danh sách public đều bắt đầu bằng prefix này -> khi cần
// invalidate, xóa TOÀN BỘ key khớp prefix
const PUBLISHED_EVENTS_CACHE_PREFIX = 'events:published:';
const PUBLISHED_EVENTS_CACHE_TTL_SECONDS = Number(
  process.env.EVENTS_CACHE_TTL_SECONDS ?? 60,
);


@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService
  ) { }

  create(organizerId: string, dto: CreateEventDto) {
    return this.prisma.event.create({
      data: {
        ...dto,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        organizerId,
        status: EventStatus.DRAFT
      }
    })
  }

  async update(id: string, organizerId: string, dto: UpdateEventDto) {
    const event = await this.searchEventByOrganizer(id, organizerId)
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
      await this.cacheService.delByPrefix(PUBLISHED_EVENTS_CACHE_PREFIX);
    }

    return updated;
  }

  async cancel(id: string, currentUser: { userId: string; role: string }) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Không tìm thấy sự kiện');

    const isOwner = event.organizerId === currentUser.userId;
    const isAdmin = currentUser.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Bạn không có quyền hủy sự kiện này');
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.CANCELLED },
    });

    // Nếu event đang PUBLISHED thì giờ nó phải BIẾN MẤT khỏi danh sách public
    if (event.status === EventStatus.PUBLISHED) {
      await this.cacheService.delByPrefix(PUBLISHED_EVENTS_CACHE_PREFIX);
    }

    return updated
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
    await this.cacheService.delByPrefix(PUBLISHED_EVENTS_CACHE_PREFIX);

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

    const cacheKey = this.buildPublishedCacheKey(query);
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const events = await this.prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        location: query.location ? { contains: query.location, mode: 'insensitive' } : undefined, // mode insensitive: khong phan biet hoa thuong
        category: query.category ?? undefined,
        title: query.search ? { contains: query.search, mode: 'insensitive' } : undefined
      },
      include: { ticketTypes: true },
      orderBy: { startTime: 'asc' }
    });

    await this.cacheService.set(cacheKey, events, PUBLISHED_EVENTS_CACHE_TTL_SECONDS);
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

  private buildPublishedCacheKey(query: findEventsQueryDto): string {
    const location = query.location ?? '';
    const category = query.category ?? '';
    const search = query.search ?? '';
    return `${PUBLISHED_EVENTS_CACHE_PREFIX}${location}:${category}:${search}`;
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
