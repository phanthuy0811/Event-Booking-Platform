import { Inject, Injectable, Logger, RequestTimeoutException } from "@nestjs/common";
import { REDIS_LOCK } from "./redis.constants";
import Redis from 'ioredis';
import { randomUUID } from "crypto";

// Lua script đảm bảo tính nguyên tử của việc giải phóng lock.
// Chỉ người sở hữu lock mới có thể xoá nó.
const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end
`;

export interface LockOptions {
    ttlMs?: number; // Lock tự hết hạn trong bao lâu nếu quên release
    retryDelayMs?: number; // Khoảng nghỉ giữa các lần thử acquire lại
    maxRetries?: number // số lần thử tối đa trước khi bỏ cuộc
}

@Injectable()
export class RedisLockService {
    private readonly logger = new Logger(RedisLockService.name);

    // Inject kết nối Redis 
    constructor(@Inject(REDIS_LOCK) private readonly redis: Redis) { }

    async withLock<T>(
        key: string, // khóa cần được bảo vệ
        fn: () => Promise<T>,
        options: LockOptions = {},
    ): Promise<T> {
        const { ttlMs = 5000, retryDelayMs = 100, maxRetries = 30 } = options;
        const lockKey = `lock:${key}`; // Tạo khóa để giữ
        const token = randomUUID(); // tạo chìa khóa độc nhất cho mỗi yêu cầu

        const acquired = await this.acquireWithRetry(
            lockKey,
            token,
            ttlMs,
            retryDelayMs,
            maxRetries
        );

        // Nếu thử 30 lần vẫn thất bại thì báo lỗi
        if (!acquired) {
            throw new RequestTimeoutException('He thong dang xu ly qua nhieu yeu cau cho ve nay, vui long thu lai sau')
        }

        try {
            return await fn();  // tiếp tục xử lý logic booking
        } finally {
            await this.release(lockKey, token); // sau cùng thì trả lại lock
        }

    }

    private async acquireWithRetry(
        lockKey: string,
        token: string,
        ttlMs: number,
        retryDelayMs: number,
        maxRetries: number
    ): Promise<boolean> {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            // Gửi lệnh lên redis để giữ khóa lockkey với chìa khóa là token
            // 'NX' = Not Exists (Chỉ thành công khi chưa có khóa nào được tạo)
            // 'PX' = Tự động xóa khóa này sau ttlMs mili-giây
            const result = await this.redis.set(lockKey, token, 'PX', ttlMs, 'NX');
            if (result === 'OK') {
                return true;
            }
            const jitter = Math.random() * 50;
            await this.sleep(retryDelayMs + jitter);
        }
        return false;
    }

    private async release(lockKey: string, token: string): Promise<void> {
        try {
            await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, token);
        } catch (err) {
            this.logger.error(`Khong release duoc lock ${lockKey}, ${err}`);
        }
    }

    private sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

}