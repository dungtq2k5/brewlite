import { describe, expect, it, vi } from 'vitest';
import { localErrorCode } from '@brewlite/nest-common';
import { FakePaymentProvider } from '../../providers/payment/fake.payment-provider.js';
import { WebhookService } from './webhook.service.js';

describe('WebhookService.handleStripeEvent — with the fake provider', () => {
  it('refuses every delivery as WEBHOOK_SIGNATURE_INVALID before touching the database', async () => {
    const prisma = { $transaction: vi.fn() };
    const service = new WebhookService(
      prisma as never,
      {} as never,
      {} as never,
      new FakePaymentProvider(),
    );

    const error = await service
      .handleStripeEvent({ payload: Buffer.from('{}'), signature: 't=1,v1=anything' })
      .catch((e: unknown) => e);

    expect(localErrorCode(error)).toBe('WEBHOOK_SIGNATURE_INVALID');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
