import { MailTemplateService } from "./mail-template.service";

describe('MailTemplateService', () => {
    let service: MailTemplateService;
    beforeEach(() => { service = new MailTemplateService(); });

    it('should escape <script> tag in event title', () => {
        const html = service.buildBookingConfirmation({
            eventTitle: '<script>alert("xss")</script>',
            eventStartTime: '2026-01-01',
            eventLocation: 'Hà Nội',
            ticketTypeName: 'VIP',
            quantity: 2,
            totalAmount: '500000',
        });
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('should escape img onerror injection', () => {
        const html = service.buildBookingConfirmation({
            eventTitle: '<img src=x onerror=alert(1)>',
            eventStartTime: '2026-01-01',
            eventLocation: 'Hà Nội',
            ticketTypeName: 'Standard',
            quantity: 1,
            totalAmount: '100000',
        });
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img');
    });
});
