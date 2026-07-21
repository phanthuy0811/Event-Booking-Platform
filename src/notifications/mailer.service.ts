import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
    to: string,
    subject: string,
    html: string
}

@Injectable()
export class MailerService {
    private readonly logger = new Logger(MailerService.name);
    private transporter: nodemailer.Transporter | null = null;

    constructor() {
        if (process.env.SMTP_HOST) {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT ?? 587),
                auth: process.env.SMTP_USER
                    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                    : undefined,
            });
        }
    }

    async sendEmail(options: SendMailOptions): Promise<void> {
        if (!this.transporter) {
            this.logger.log(
                `[MOCK EMAIL - chưa cấu hình SMTP] to=${options.to} subject="${options.subject}"`,
            );
            this.logger.debug(options.html);
            return;
        }

        await this.transporter.sendMail({
            from: process.env.MAIL_FROM ?? 'no-reply@event-booking.local',
            to: options.to,
            subject: options.subject,
            html: options.html
        });
    }
}
