import { Injectable } from '@nestjs/common';

@Injectable()
export class MailTemplateService {

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    buildBookingConfirmation(data: {
        eventTitle: string;
        eventStartTime: string;
        eventLocation: string;
        ticketTypeName: string;
        quantity: number;
        totalAmount: string;
    }): string {
        return `
            <h2>Xác nhận đặt vé thành công</h2>
            <p>Sự kiện: <b>${this.escape(data.eventTitle)}</b></p>
            <p>Thời gian: ${this.escape(data.eventStartTime)}</p>
            <p>Địa điểm: ${this.escape(data.eventLocation)}</p>
            <p>Hạng vé: ${this.escape(data.ticketTypeName)} x ${data.quantity}</p>
            <p>Tổng tiền: ${this.escape(data.totalAmount)}</p>
        `;
    }

    buildEventReminder(data: {
        eventTitle: string;
        eventStartTime: string;
        eventLocation: string;
    }): string {
        return `
            <h2>Sắp đến giờ sự kiện</h2>
            <p>Sự kiện: <b>${this.escape(data.eventTitle)}</b></p>
            <p>Thời gian: ${this.escape(data.eventStartTime)}</p>
            <p>Địa điểm: ${this.escape(data.eventLocation)}</p>
        `;
    }

    buildEventCancellation(data: {
        eventTitle: string;
    }): string {
        return `
            <h2>Sự kiện đã bị hủy</h2>
            <p>Sự kiện <b>${this.escape(data.eventTitle)}</b> đã bị hủy.</p>
            <p>Nếu bạn đã thanh toán, hoàn tiền sẽ được xử lý sớm.</p>
        `;
    }
}
