import { IsIn, IsString } from 'class-validator';

export class PaymentWebhookDto {
    // referenceId do CHÍNH HỆ THỐNG sinh ra lúc initiate() (đóng vai trò
    // "mã giao dịch" mà 1 cổng thanh toán thật sẽ trả về và gửi lại trong webhook)
    @IsString()
    referenceId: string;

    @IsIn(['PAID', 'FAILED'])
    status: 'PAID' | 'FAILED';
}