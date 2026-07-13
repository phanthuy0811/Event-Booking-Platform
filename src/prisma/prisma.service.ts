import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
        // ket noi db ngay khi app khoi dong
        await this.$connect();
    }

    async onModuleDestroy() {
        // ngat ket noi db khi app tat
        await this.$disconnect();
    }
}