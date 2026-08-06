import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReservationsService } from 'src/reservations/reservations.service';

describe('Reservation Concurrency Test (Integration)', () => {
    let app: TestingModule;
    let reservationsService: ReservationsService;
    let prisma: PrismaService;
    let ticketTypeId: string;

    beforeAll(async () => {
        app = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        reservationsService = app.get(ReservationsService);
        prisma = app.get(PrismaService);

        // 1. Tạo dữ liệu giả lập với đúng 1 vé duy nhất còn lại
        const organizer = await prisma.user.create({
            data: { email: `org-${Date.now()}@test.com`, passwordHash: 'hash', fullName: 'Org' },
        });
        const event = await prisma.event.create({
            data: {
                title: 'Event Concurrency Test',
                location: 'HN',
                startTime: new Date(Date.now() + 86400000),
                endTime: new Date(Date.now() + 172800000),
                status: 'PUBLISHED',
                organizerId: organizer.id,
            },
        });
        const ticketType = await prisma.ticketType.create({
            data: { eventId: event.id, name: 'Vé Cuối Cùng', price: 100000, totalQuantity: 1, remainingQuantity: 1 },
        });
        ticketTypeId = ticketType.id;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('10 requests tranh mua 1 chiếc vé còn lại -> Đúng 1 request thành công, 9 request thất bại', async () => {
        // Tạo 10 user giả lập
        const users = await Promise.all(
            Array.from({ length: 10 }).map((_, i) =>
                prisma.user.create({ data: { email: `buyer-${Date.now()}-${i}@test.com`, passwordHash: 'hash', fullName: 'Buyer' } }),
            ),
        );

        // Gửi 10 request mua vé đồng thời bằng Promise.allSettled
        const results = await Promise.allSettled(
            users.map((u) => reservationsService.create(u.id, { ticketTypeId, quantity: 1 })),
        );

        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');

        // KIỂM TRA ĐIỀU KIỆN (Business Invariant)
        expect(fulfilled.length).toBe(1); // Đúng 1 người mua thành công
        expect(rejected.length).toBe(9);   // 9 người bị từ chối

        // Số lượng vé còn lại trong DB phải bằng 0 (không bị âm)
        const updatedTicket = await prisma.ticketType.findUnique({ where: { id: ticketTypeId } });
        expect(updatedTicket?.remainingQuantity).toBe(0);
    });
});
