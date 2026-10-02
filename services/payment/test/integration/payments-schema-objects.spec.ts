import { describe, expect, it } from 'vitest';
import { newId } from '@brewlite/contracts';
import { prisma } from '../setup/per-file.js';

function payment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: newId(),
    orderId: newId(),
    userId: newId(),
    amountVnd: 50_000,
    provider: 'FAKE',
    status: 'PENDING',
    idempotencyKey: newId(),
    requestHash: 'x'.repeat(64),
    ...overrides,
  };
}

describe('payments P-1 schema objects', () => {
  it('payments_amount_ck is re-added NOT VALID, so an older row cannot fail a deploy', async () => {
    const [row] = await prisma.$queryRaw<{ convalidated: boolean }[]>`
      SELECT convalidated FROM pg_constraint WHERE conname = 'payments_amount_ck'`;
    expect(row?.convalidated).toBe(false);
  });

  it('refuses amount_vnd below MIN_PAYABLE_VND (15,000) and allows exactly it', async () => {
    await expect(prisma.payment.create({ data: payment({ amountVnd: 14_999 }) })).rejects.toThrow();
    await expect(
      prisma.payment.create({ data: payment({ amountVnd: 15_000 }) }),
    ).resolves.toBeDefined();
  });

  it('refuses SUCCEEDED without succeeded_at', async () => {
    await expect(
      prisma.payment.create({ data: payment({ status: 'SUCCEEDED' }) }),
    ).rejects.toThrow();
  });

  it('refuses a second PENDING payment for the same order', async () => {
    const orderId = newId();
    await prisma.payment.create({ data: payment({ orderId }) });
    await expect(prisma.payment.create({ data: payment({ orderId }) })).rejects.toThrow();
  });

  it('allows a second, non-PENDING payment for the same order', async () => {
    const orderId = newId();
    await prisma.payment.create({ data: payment({ orderId }) });
    await expect(
      prisma.payment.create({
        data: payment({ orderId, status: 'FAILED', failureReason: 'SIMULATED' }),
      }),
    ).resolves.toBeDefined();
  });
});
