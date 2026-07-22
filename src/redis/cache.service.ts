import { Inject, Injectable, Logger } from "@nestjs/common";
import { REDIS_LOCK } from "./redis.constants";
import Redis from "ioredis";

@Injectable()
export class CacheService {
    private readonly logger = new Logger(CacheService.name);
    constructor(@Inject(REDIS_LOCK) private readonly redis: Redis) { }

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
}