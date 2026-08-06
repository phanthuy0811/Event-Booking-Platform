import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReservationsService } from 'src/reservations/reservations.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReservationStatus, Prisma } from '@prisma/client';

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaService: any;

  const mockPrismaService = {
    reservation: { findUnique: jest.fn() },
    order: { findUnique: jest.fn(), create: jest.fn() },
  };
  const mockReservationsService = { releaseInternal: jest.fn() };
  const mockNotificationsService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ReservationsService, useValue: mockReservationsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prismaService = module.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('createFromReservation', () => {
    it('1. Happy path: Tạo đơn hàng thành công từ giữ chỗ đang HOLDING', async () => {
      const mockReservation = {
        id: 'res-1',
        userId: 'user-1',
        status: ReservationStatus.HOLDING,
        quantity: 2,
        ticketTypeId: 'ticket-1',
        ticketType: { price: new Prisma.Decimal(100000) },
      };

      mockPrismaService.reservation.findUnique.mockResolvedValue(mockReservation);
      mockPrismaService.order.findUnique.mockResolvedValue(null);
      mockPrismaService.order.create.mockResolvedValue({ id: 'order-1', totalAmount: new Prisma.Decimal(200000) });

      const result = await service.createFromReservation('user-1', 'res-1');

      expect(result.id).toBe('order-1');
      expect(mockPrismaService.order.create).toHaveBeenCalled();
    });

    it('2. Forbidden: Ném lỗi nếu user tạo đơn không phải chủ sở hữu giữ chỗ', async () => {
      const mockReservation = { id: 'res-1', userId: 'other-user', status: ReservationStatus.HOLDING };
      mockPrismaService.reservation.findUnique.mockResolvedValue(mockReservation);

      await expect(service.createFromReservation('user-1', 'res-1')).rejects.toThrow(ForbiddenException);
    });

    it('3. Invalid state: Ném lỗi nếu giữ chỗ không ở trạng thái HOLDING', async () => {
      const mockReservation = { id: 'res-1', userId: 'user-1', status: ReservationStatus.EXPIRED };
      mockPrismaService.reservation.findUnique.mockResolvedValue(mockReservation);

      await expect(service.createFromReservation('user-1', 'res-1')).rejects.toThrow(BadRequestException);
    });
  });
});
