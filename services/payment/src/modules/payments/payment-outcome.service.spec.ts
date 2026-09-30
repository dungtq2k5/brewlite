import { describe, expect, it, vi } from 'vitest';
import { PaymentFailureReason, PaymentMethod, PaymentStatus } from '@brewlite/contracts';
import { PaymentOutcomeService } from './payment-outcome.service.js';

function buildTx(row: Record<string, unknown>) {
  return {
    payment: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirstOrThrow: vi.fn().mockResolvedValue(row),
    },
  };
}

describe('PaymentOutcomeService.apply', () => {
  it('refuses a non-PENDING payment with INVALID_STATE', async () => {
    const tx = buildTx({ id: 'p1', status: PaymentStatus.SUCCEEDED });
    tx.payment.updateMany.mockResolvedValueOnce({ count: 0 });
    const outbox = { add: vi.fn() };
    const service = new PaymentOutcomeService(outbox as never);

    await expect(
      service.apply(tx as never, 'p1', { kind: 'SUCCEEDED', method: PaymentMethod.FAKE }),
    ).rejects.toThrow();
    expect(outbox.add).not.toHaveBeenCalled();
  });

  it('SUCCEEDED writes payment.payment.succeeded', async () => {
    const row = {
      id: 'p1',
      orderId: 'o1',
      userId: 'u1',
      amountVnd: 50_000,
      status: PaymentStatus.SUCCEEDED,
    };
    const tx = buildTx(row);
    const outbox = { add: vi.fn() };
    const service = new PaymentOutcomeService(outbox as never);

    await service.apply(tx as never, 'p1', { kind: 'SUCCEEDED', method: PaymentMethod.FAKE });

    expect(outbox.add).toHaveBeenCalledWith(
      tx,
      'payment.payment.succeeded',
      'p1',
      expect.objectContaining({ paymentId: 'p1', orderId: 'o1', userId: 'u1', amountVnd: 50_000 }),
    );
  });

  it('FAILED writes payment.payment.failed', async () => {
    const row = { id: 'p1', orderId: 'o1', userId: 'u1', amountVnd: 50_000, status: 'FAILED' };
    const tx = buildTx(row);
    const outbox = { add: vi.fn() };
    const service = new PaymentOutcomeService(outbox as never);

    await service.apply(tx as never, 'p1', {
      kind: 'FAILED',
      reason: PaymentFailureReason.SIMULATED,
    });

    expect(outbox.add).toHaveBeenCalledWith(
      tx,
      'payment.payment.failed',
      'p1',
      expect.objectContaining({
        paymentId: 'p1',
        orderId: 'o1',
        reason: PaymentFailureReason.SIMULATED,
      }),
    );
  });
});
