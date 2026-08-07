import { Inject, Injectable, Logger } from "@nestjs/common";
import { REDIS_LOCK } from "./redis.constants";
import Redis from "ioredis";

@Injectable()
export class CacheService {
    private readonly logger = new Logger(CacheService.name);
    private readonly EVENTS_VERSION_KEY = 'events:published:version'
    constructor(
        @Inject(REDIS_LOCK) private readonly redis: Redis,
    ) { }

    async get<T>(key: string): Promise<T | null> {
        const raw = await this.redis.get(key)
        if (!raw) return null;
        try {
            return JSON.parse(raw) as T;
        } catch (err) {
            return null;
        }
    }

    async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
        await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    }

    async del(key: string): Promise<void> {
        await this.redis.del(key);
    }

    // Xóa TẤT CẢ key khớp prefix - dùng khi 1 hành động (vd sửa event) có thể
    // làm sai lệch NHIỀU cache key khác nhau
    async delByPrefix(prefix: string): Promise<void> {
        const stream = this.redis.scanStream({ match: `${prefix}*`, count: 100 });
        const pipeline = this.redis.pipeline();
        let found = false;

        for await (const keys of stream as unknown as AsyncIterable<string[]>) {
            if (keys.length) {
                found = true;
                keys.forEach((key) => pipeline.del(key));
            }
        }

        if (found) {
            await pipeline.exec();
        }
    }

    // Lấy version hiện tại (dùng để build cache key có version)
    async getEventsVersion(): Promise<number> {
        const v = await this.redis.get(this.EVENTS_VERSION_KEY);
        return v ? parseInt(v, 10) : 0;
    }
    // Invalidate bằng cách tăng version — KHÔNG cần SCAN
    // Toàn bộ cache key cũ sẽ tự nhiên bị "lỗi thời" vì key mới sẽ khác version
    async invalidatePublishedEvents(): Promise<void> {
        await this.redis.incr(this.EVENTS_VERSION_KEY);
    }
}