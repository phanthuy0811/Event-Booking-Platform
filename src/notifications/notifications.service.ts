import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AppGateway } from 'src/websocket/websocket.gateway';
import { MailerService } from './mailer.service';
import { InjectQueue } from '@nestjs/bullmq';
import { NOTIFICATION_REMINDER_JOB, NOTIFICATION_REMINDER_QUEUE } from './notifications.constants';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderStatus, EventStatus } from '@prisma/client';
import { CursorPaginationDto } from 'src/common/dto/cursor-pagination.dto';
import { buildCursorResponse } from 'src/common/dto/cursor-paginated-response.dto';
import { MailTemplateService } from './mail-template.service';


const ORDER_WITH_EVENT_INCLUDE = {
  user: true,
  items: { include: { ticketType: { include: { event: true } } } }
} as const;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appGateway: AppGateway,
    private readonly mailerService: MailerService,
    private readonly mailTemplateService: MailTemplateService,
    @InjectQueue(NOTIFICATION_REMINDER_QUEUE)
    private readonly reminderQueue: Queue,
  ) { }

  // Được orderservice gọi ngay sau khi order chuyển trạng thái thành PAID
  async sendBookingConfirmation(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_WITH_EVENT_INCLUDE
    });
    if (!order) return;

    const item = order.items[0];
    const event = item.ticketType.event;

    const title = 'Dat ve thanh cong';
    const message = `Bạn đã đặt ${item.quantity} vé "${item.ticketType.name}" cho sự kiện "${event.title}"`;

    await this.createAndPush(order.userId, 'booking_confirmed', title, message);

    await this.mailerService.sendEmail({
      to: order.user.email,
      subject: `Xác nhận đặt vé - ${event.title}`,
      html: this.mailTemplateService.buildBookingConfirmation({
        eventTitle: event.title,
        eventStartTime: event.startTime.toLocaleString('vi-VN'),
        eventLocation: event.location,
        ticketTypeName: item.ticketType.name,
        quantity: item.quantity,
        totalAmount: String(order.totalAmount),
      }),
    });

  }

  // Được OrdersService gọi ngay sau sendBookingConfirmation
  // Tính thời điểm cần nhắc dựa trên event.startTime - reminderMinutesBefore,
  // đẩy 1 job delay NGAY LÚC NÀY (không cần cron quét định kỳ).
  async scheduleEventReminder(orderId: string, correlationId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_WITH_EVENT_INCLUDE
    });
    if (!order) return;

    const event = order.items[0].ticketType.event;
    const reminderAt =
      event.startTime.getTime() - order.reminderMinutesBefore * 60 * 1000;
    const delay = reminderAt - Date.now();

    if (delay <= 0) {
      this.logger.log(`Order ${orderId}: bỏ qua nhắc lịch vì event đã quá sát giờ`);
      return;
    }

    await this.reminderQueue.add(
      NOTIFICATION_REMINDER_JOB,
      { orderId, correlationId },
      { delay, jobId: `reminder-${orderId}` },
    )
  }


  // Được NotificationsProcessor gọi khi tới giờ hẹn
  async sendEventReminder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_WITH_EVENT_INCLUDE,
    });

    // Idempotent/an toàn: nếu order đã bị hủy/hoàn tiền sau khi lên lịch,
    // hoặc event đã bị organizer hủy -> không nhắc nữa
    if (!order || order.status !== OrderStatus.PAID) return;
    const event = order.items[0].ticketType.event;
    if (event.status === EventStatus.CANCELLED) return;

    const title = 'Sắp đến giờ sự kiện';
    const message = `Sự kiện "${event.title}" sẽ diễn ra lúc ${event.startTime.toLocaleString('vi-VN')}`;

    await this.createAndPush(order.userId, 'event_reminder', title, message);

    await this.mailerService.sendEmail({
      to: order.user.email,
      subject: `Nhắc lịch: ${event.title} sắp diễn ra`,
      html: this.mailTemplateService.buildEventReminder({
        eventTitle: event.title,
        eventStartTime: event.startTime.toLocaleString('vi-VN'),
        eventLocation: event.location,
      }),
    });
  }


  async findMine(userId: string, dto: CursorPaginationDto) {
    const { cursor, limit } = dto;
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return buildCursorResponse(notifications, limit);
  }

  // Đánh dấu thông báo là đã đọc 
  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Không tìm thấy thông báo');
    if (notification.userId !== userId) {
      throw new ForbiddenException('Đây không phải thông báo của bạn');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }


  // Lưu DB TRƯỚC (để user luôn xem lại được dù đang online hay không),
  // sau đó thử đẩy realtime - nếu user không online, pushNotificationToUser
  // chỉ trả về false, không throw lỗi gì cả.
  private async createAndPush(userId: string, type: string, title: string, message: string) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, message },
    });
    this.appGateway.pushNotificationToUser(userId, notification);
    return notification;
  }


  // Gửi notification khi event bị hủy
  async sendEventCancellationNotification(userId: string, eventTitle: string) {
    const title = 'Sự kiện đã bị hủy';
    const message = `Sự kiện "${eventTitle}" đã bị hủy. Nếu bạn đã thanh toán, hoàn tiền sẽ được xử lý sớm.`;

    await this.createAndPush(userId, 'event_cancelled', title, message);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) return;

    await this.mailerService.sendEmail({
      to: user.email,
      subject: `Thông báo hủy sự kiện: ${eventTitle}`,
      html: this.mailTemplateService.buildEventCancellation({ eventTitle }),
    });
  }

}
