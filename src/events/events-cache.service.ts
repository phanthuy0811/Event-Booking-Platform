import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CacheService } from "src/redis/cache.service";
import { findEventsQueryDto } from "./dto/find-events-query.dto";

@Injectable()
export class EventsCacheService {
    private readonly TTL: number;

    constructor(
        private readonly cacheService: CacheService,
        private readonly configService: ConfigService
    ) {
        this.TTL = this.configService.get<number>('EVENTS_CACHE_TTL_SECONDS', 60);
    }

    // Normalize input để tránh tạo nhiều cache key trùng nội dung
    private normalize(value?: string): string {
        if (!value) return '';
        return value
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .slice(0, 100);
    }

    // Build cache key có version — invalidate chỉ cần tăng version
    async buildKey(query: findEventsQueryDto): Promise<string> {
        const version = await this.cacheService.getEventsVersion();
        const location = this.normalize(query.location);
        const category = this.normalize(query.category);
        const search = this.normalize(query.search);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        return `events:published:v${version}:${location}:${category}:${search}:p${page}:l${limit}`;
    }

    async getPublishedEvents(query: findEventsQueryDto): Promise<unknown | null> {
        try {
            const key = await this.buildKey(query);
            return this.cacheService.get(key);
        } catch {
            return null;
        }
    }

    async setPublishedEvents(query: findEventsQueryDto, data: unknown): Promise<void> {
        try {
            const key = await this.buildKey(query);
            await this.cacheService.set(key, data, this.TTL);
        } catch {
        }
    }
    async invalidatePublishedEvents(): Promise<void> {
        try {
            await this.cacheService.invalidatePublishedEvents();
        } catch {
        }
    }
}