import { Global, Module } from "@nestjs/common";
import { REDIS_LOCK } from "./redis.constants";
import { RedisLockService } from "./redis-lock.service";
import Redis from "ioredis";
import { CacheService } from "./cache.service";

// Tách riêng client này khỏi connection BullMQ dùng ở QueueModule:
// BullMQ tự quản lý connection riêng theo cách của nó, còn lock cần
// full quyền điều khiển lệnh SET/EVAL trực tiếp -> nên có client riêng.
@Global()
@Module({
    providers: [
        {
            provide: REDIS_LOCK,
            useFactory: () => {
                // tạo kết nối tới server redis để sử dụng cho các lệnh lock
                return new Redis({
                    host: process.env.REDIS_HOST ?? 'localhost',
                    port: Number(process.env.REDIS_PORT ?? 6379),
                });
            },
        },
        RedisLockService,
        CacheService
    ],
    exports: [REDIS_LOCK, RedisLockService, CacheService],
})

export class RedisModule { }