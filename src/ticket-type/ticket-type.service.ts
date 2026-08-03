import { BadRequestException, ForbiddenException, Injectable, NotAcceptableException, NotFoundException } from '@nestjs/common';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { EventStatus } from '@prisma/client';

@Injectable()
export class TicketTypeService {
  constructor(private readonly prisma: PrismaService) { }

  async create(eventId: string, organizerId: string, dto: CreateTicketTypeDto) {
    await this.searchEventByOrganizer(eventId, organizerId)
    return this.prisma.ticketType.create({
      data: {
        eventId,
        ...dto,
        salesStart: dto.salesStart ? new Date(dto.salesStart) : undefined,
        salesEnd: dto.salesEnd ? new Date(dto.salesEnd) : undefined,
        remainingQuantity: dto.totalQuantity,
      }
    })
  }

  async update(eventId: string, ticketTypeId: string, organizerId: string, dto: UpdateTicketTypeDto) {
    const ticketType = await this.findOwnedTicketType(ticketTypeId, eventId, organizerId);

    let remainingQuantity: number | undefined
    if (dto.totalQuantity !== undefined) {
      const sold = ticketType.totalQuantity - ticketType.remainingQuantity;
      if (dto.totalQuantity < sold) {
        throw new BadRequestException('Khong the dat tong so ve nho hon so ve da ban')
      }
      remainingQuantity = dto.totalQuantity - sold
    }

    return this.prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: {
        ...dto,
        salesStart: dto.salesStart ? new Date(dto.salesStart) : undefined,
        salesEnd: dto.salesEnd ? new Date(dto.salesEnd) : undefined,
        remainingQuantity
      }
    })
  }

  async delete(eventId: string, ticketTypeId: string, organizerId: string) {
    const ticketType = await this.findOwnedTicketType(ticketTypeId, eventId, organizerId);

    if (ticketType.totalQuantity !== ticketType.remainingQuantity) {
      throw new BadRequestException('Khong the xoa hang ve da duoc ban');
    }
    return this.prisma.ticketType.delete({
      where: { id: ticketTypeId }
    })
  }

  async findOne(id: string) {
    const ticketType = await this.prisma.ticketType.findUnique({
      where: { id },
    });
    if (!ticketType) throw new NotFoundException('Không tìm thấy hạng vé');
    return ticketType;
  }

  async findOwnedTicketType(ticketTypeId: string, eventId: string, organizerId: string) {
    const ticketType = await this.prisma.ticketType.findFirst({
      where: {
        id: ticketTypeId,
        eventId,
        event: {
          organizerId
        },
      }
    });
    if (!ticketType) {
      throw new NotFoundException("Khong tim thay hang ve");
    }
    return ticketType;
  }

  async findAllTicketType(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('Khong tim thay su kien');
    }
    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException('Su kien chua duoc cong bo');
    }

    return this.prisma.ticketType.findMany({
      where: { eventId },
      orderBy: { price: 'asc' }
    })
  }

  async searchEventByOrganizer(id: string, organizerId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: id }
    })
    if (!event) {
      throw new NotFoundException('Khong tim thay su kien')
    }
    if (event.organizerId !== organizerId) {
      throw new ForbiddenException('Ban khong phai chu su kien nay')
    }
    return event;

  }
}
