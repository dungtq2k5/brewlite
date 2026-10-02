import { Controller, HttpCode, Post, Req, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { apiError, Auth, RateLimit, SkipEnvelope } from '@brewlite/nest-common';
import { WebhookServiceGrpcClient } from './webhook-service-grpc.client.js';

/**
 * Version-neutral, so `/api/webhooks/stripe` never moves once registered with Stripe
 * (api §0.9). The gateway parses nothing and logs neither the body nor the signature:
 * payment verifies the signature over the raw bytes (conventions §9.3).
 */
@ApiExcludeController()
@Controller({ path: 'webhooks/stripe', version: VERSION_NEUTRAL })
@Auth('SIGNATURE')
@RateLimit('NONE')
export class StripeWebhookController {
  constructor(private readonly webhook: WebhookServiceGrpcClient) {}

  @Post()
  @HttpCode(200)
  @SkipEnvelope()
  async receive(@Req() req: Request & { rawBody?: Buffer }): Promise<{ received: true }> {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string' || !req.rawBody) throw apiError('WEBHOOK_SIGNATURE_INVALID');
    await this.webhook.handleStripeEvent(
      { payload: req.rawBody, signature },
      req.id as string | undefined,
    );
    return { received: true };
  }
}
