import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";


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
            }
        }),
    ],
    exports: [BullModule],
})
export class QueueModule { }
