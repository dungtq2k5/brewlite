import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ApiEnvelope, ApiErrors, Auth, RateLimit } from '@brewlite/nest-common';
import { Ctx, type UserContext } from '../../auth/request-context.js';
import {
  ApiIdempotencyKey,
  RequireIdempotencyKey,
} from '../../auth/require-idempotency-key.decorator.js';
import { PaymentsService } from './payments.service.js';
import {
  CreatePaymentDto,
  FakeConfirmDto,
  PaymentIdParamDto,
  PaymentResponseDto,
} from './dto/payment.dto.js';

@Controller('payments')
@Auth('USER')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @ApiIdempotencyKey()
  @RateLimit('PAYMENT')
  @ApiEnvelope(PaymentResponseDto)
  @ApiErrors(
    'RESOURCE_NOT_FOUND',
    'ORDER_NOT_PAYABLE',
    'IDEMPOTENCY_KEY_REQUIRED',
    'IDEMPOTENCY_KEY_REUSED',
  )
  async createPayment(
    @Body() dto: CreatePaymentDto,
    @RequireIdempotencyKey() idempotencyKey: string,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PaymentResponseDto> {
    const { payment, created } = await this.payments.createPayment(
      dto,
      idempotencyKey,
      ctx,
      req.id as string | undefined,
    );
    res.status(created ? 201 : 200);
    return payment;
  }

  @Get(':id')
  @ApiEnvelope(PaymentResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND')
  getPayment(
    @Param() params: PaymentIdParamDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<PaymentResponseDto> {
    return this.payments.getPayment(params.id, ctx, req.id as string | undefined);
  }

  // Answers 404 in production — the payment service refuses it there (api §4).
  // Excluded from OpenAPI so the generated client never offers it.
  @Post(':id/fake-confirm')
  @RateLimit('PAYMENT')
  @ApiEnvelope(PaymentResponseDto)
  @ApiErrors('ROUTE_NOT_FOUND', 'RESOURCE_NOT_FOUND', 'INVALID_STATE')
  @ApiExcludeEndpoint()
  fakeConfirm(
    @Param() params: PaymentIdParamDto,
    @Body() dto: FakeConfirmDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<PaymentResponseDto> {
    return this.payments.fakeConfirm(params.id, dto, ctx, req.id as string | undefined);
  }
}
