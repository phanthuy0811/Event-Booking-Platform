import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { DEFAULT_JOB_OPTIONS } from "./queue-defaults";

// kết nối Redis
// Các module khác (Reservations, sau này là Notifications reminder...)
// chỉ cần BullModule.registerQueue({ name: '...' }) mà không cần khai báo lại connection.
@Global()
@Module({
    imports: [
        BullModule.forRoot({
            connection: {
                host: process.env.REDIS_HOST ?? 'localhost',
                port: Number(process.env.REDIS_PORT ?? 6379)
            },
            defaultJobOptions: DEFAULT_JOB_OPTIONS,
        }),
    ],
    exports: [BullModule],
})
export class QueueModule { }
