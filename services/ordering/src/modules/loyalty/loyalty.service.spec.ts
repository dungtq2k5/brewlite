import { describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { LoyaltyService } from './loyalty.service.js';

function buildTx() {
  return {
    loyaltyTransaction: { create: vi.fn(), findUnique: vi.fn() },
    loyaltyAccount: { upsert: vi.fn(), update: vi.fn() },
    order: { update: vi.fn() },
  };
}

describe('LoyaltyService.earn', () => {
  it('writes nothing for a 9,999 ₫ order — floor(9999/10000) = 0', async () => {
    const tx = buildTx();
    const service = new LoyaltyService({} as never);

    await service.earn(tx as never, { id: newId(), userId: newId(), totalVnd: 9_999 });

    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
    expect(tx.loyaltyAccount.upsert).not.toHaveBeenCalled();
  });

  it('writes 5 points for a 52,200 ₫ order and updates the order row', async () => {
    const tx = buildTx();
    const service = new LoyaltyService({} as never);
    const order = { id: newId(), userId: newId(), totalVnd: 52_200 };

    await service.earn(tx as never, order);

    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ points: 5, kind: 'EARN' }) }),
    );
    expect(tx.loyaltyAccount.upsert).toHaveBeenCalledOnce();
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: order.id },
      data: { pointsEarned: 5 },
    });
  });

  it('a second earn for the same order is a no-op (unique-constraint caught)', async () => {
    const tx = buildTx();
    tx.loyaltyTransaction.create.mockRejectedValueOnce(
      Object.assign(new Error('duplicate'), {
        code: 'P2002',
        meta: { target: ['loyalty_transactions_order_id_kind_key'] },
      }),
    );
    const service = new LoyaltyService({} as never);

    await service.earn(tx as never, { id: newId(), userId: newId(), totalVnd: 52_200 });

    expect(tx.loyaltyAccount.upsert).not.toHaveBeenCalled();
  });
});

describe('LoyaltyService.reverse', () => {
  it('does nothing when the order never earned', async () => {
    const tx = buildTx();
    tx.loyaltyTransaction.findUnique.mockResolvedValueOnce(null);
    const service = new LoyaltyService({} as never);

    await service.reverse(tx as never, { id: newId(), userId: newId() });

    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
    expect(tx.loyaltyAccount.update).not.toHaveBeenCalled();
  });

  it('inserts EARN_REVERSED with -points and decrements the balance', async () => {
    const tx = buildTx();
    tx.loyaltyTransaction.findUnique.mockResolvedValueOnce({ points: 5 });
    const service = new LoyaltyService({} as never);
    const order = { id: newId(), userId: newId() };

    await service.reverse(tx as never, order);

    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ points: -5, kind: 'EARN_REVERSED' }),
      }),
    );
    expect(tx.loyaltyAccount.update).toHaveBeenCalledWith({
      where: { userId: order.userId },
      data: { balance: { decrement: 5 } },
    });
  });
});
