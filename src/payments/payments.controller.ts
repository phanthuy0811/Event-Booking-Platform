import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { MockWebhookGuard } from 'src/common/guards/mock-webhook.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) { }

  @UseGuards(JwtAuthGuard)
  @Post()
  initiate(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePaymentDto
  ) {
    return this.paymentsService.initiate(user.userId, dto.orderId, user.requestId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('order/:orderId')
  findByOrder(
    @Param('orderId') orderId: string,
    @CurrentUser() user: CurrentUserPayload
  ) {
    return this.paymentsService.findByOrder(orderId, user.userId);
  }

  @UseGuards(MockWebhookGuard)
  @Post('webhook')
  webhook(@Body() dto: PaymentWebhookDto) {
    return this.paymentsService.handleWebhook(dto.referenceId, dto.status);
  }
}
