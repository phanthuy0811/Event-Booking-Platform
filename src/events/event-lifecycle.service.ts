import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventStatus } from '@prisma/client';
import { EventsCacheService } from './events-cache.service';

@Injectable()
export class EventLifecycleService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventsCacheService: EventsCacheService,
    ) { }

    async submitForApproval(id: string, organizerId: string) {
        const result = await this.prisma.event.updateMany({
            where: {
                id,
                organizerId,
                status: { in: [EventStatus.DRAFT, EventStatus.REJECTED] }
            },
            data: { status: EventStatus.PENDING_APPROVAL },
        });

        if (result.count === 0) {
            throw new ConflictException('Sự kiện không hợp lệ để gửi duyệt (phải ở trạng thái DRAFT hoặc REJECTED)');
        }
    }

    async approve(id: string) {
        const result = await this.prisma.event.updateMany({
            where: { id, status: EventStatus.PENDING_APPROVAL },
            data: { status: EventStatus.PUBLISHED },
        });

        if (result.count === 0) {
            throw new ConflictException('Sự kiện không ở trạng thái chờ duyệt (PENDING_APPROVAL)');
        }

        await this.eventsCacheService.invalidatePublishedEvents();
    }

    async reject(id: string) {
        const result = await this.prisma.event.updateMany({
            where: { id, status: EventStatus.PENDING_APPROVAL },
            data: { status: EventStatus.REJECTED },
        });

        if (result.count === 0) {
            throw new ConflictException('Sự kiện không ở trạng thái chờ duyệt để từ chối');
        }
    }

    async close(id: string) {
        const result = await this.prisma.event.updateMany({
            where: { id, status: EventStatus.PUBLISHED },
            data: { status: EventStatus.CLOSED },
        });

        if (result.count === 0) {
            throw new ConflictException('Chỉ có thể đóng sự kiện đang được PUBLISHED');
        }

        await this.eventsCacheService.invalidatePublishedEvents();
    }
}
