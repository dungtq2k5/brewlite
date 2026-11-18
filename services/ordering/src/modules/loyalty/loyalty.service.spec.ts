import { describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { LoyaltyService } from './loyalty.service.js';

function buildTx() {
  return {
    loyaltyTransaction: { create: vi.fn(), findUnique: vi.fn() },
    loyaltyAccount: { upsert: vi.fn(), update: vi.fn() },
    order: { update: vi.fn() },
    $queryRaw: vi.fn(),
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
    tx.$queryRaw.mockResolvedValueOnce([{ balance: 12 }]); // the locked balance covers it
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

  it('removes only what the balance holds — the shortfall is forgiven (ADR 0035)', async () => {
    const tx = buildTx();
    tx.loyaltyTransaction.findUnique.mockResolvedValueOnce({ points: 17 });
    tx.$queryRaw.mockResolvedValueOnce([{ balance: 7 }]);
    const service = new LoyaltyService({} as never);
    const order = { id: newId(), userId: newId() };

    await service.reverse(tx as never, order);

    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ points: -7 }) }),
    );
    expect(tx.loyaltyAccount.update).toHaveBeenCalledWith({
      where: { userId: order.userId },
      data: { balance: { decrement: 7 } },
    });
  });

  it('writes no row when the balance is already zero', async () => {
    const tx = buildTx();
    tx.loyaltyTransaction.findUnique.mockResolvedValueOnce({ points: 17 });
    tx.$queryRaw.mockResolvedValueOnce([{ balance: 0 }]);
    const service = new LoyaltyService({} as never);

    await service.reverse(tx as never, { id: newId(), userId: newId() });

    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
    expect(tx.loyaltyAccount.update).not.toHaveBeenCalled();
  });
});

const duplicateKey = () =>
  Object.assign(new Error('duplicate'), {
    code: 'P2002',
    meta: { target: ['loyalty_transactions_order_id_kind_key'] },
  });

describe('LoyaltyService — a failure that is NOT the (order_id, kind) key propagates', () => {
  it('earn rethrows it and touches no balance', async () => {
    const tx = buildTx();
    tx.loyaltyTransaction.create.mockRejectedValueOnce(new Error('connection lost'));
    const service = new LoyaltyService({} as never);

    await expect(
      service.earn(tx as never, { id: newId(), userId: newId(), totalVnd: 52_200 }),
    ).rejects.toThrow('connection lost');
    expect(tx.loyaltyAccount.upsert).not.toHaveBeenCalled();
  });

  it('returnRedeemed rethrows it and touches no balance', async () => {
    const tx = buildTx();
    tx.loyaltyTransaction.findUnique.mockResolvedValueOnce({ points: -3 });
    tx.loyaltyTransaction.create.mockRejectedValueOnce(new Error('connection lost'));
    const service = new LoyaltyService({} as never);

    await expect(
      service.returnRedeemed(tx as never, { id: newId(), userId: newId() }),
    ).rejects.toThrow('connection lost');
    expect(tx.loyaltyAccount.update).not.toHaveBeenCalled();
  });

  it('reverse rethrows it and touches no balance', async () => {
    const tx = buildTx();
    tx.loyaltyTransaction.findUnique.mockResolvedValueOnce({ points: 5 });
    tx.$queryRaw.mockResolvedValueOnce([{ balance: 12 }]);
    tx.loyaltyTransaction.create.mockRejectedValueOnce(new Error('connection lost'));
    const service = new LoyaltyService({} as never);

    await expect(service.reverse(tx as never, { id: newId(), userId: newId() })).rejects.toThrow(
      'connection lost',
    );
    expect(tx.loyaltyAccount.update).not.toHaveBeenCalled();
  });
});

describe('LoyaltyService.returnRedeemed', () => {
  it('gives the spent points back whole, as a positive REDEEM_RETURNED row', async () => {
    const tx = buildTx();
    tx.loyaltyTransaction.findUnique.mockResolvedValueOnce({ points: -3 });
    const service = new LoyaltyService({} as never);
    const order = { id: newId(), userId: newId() };

    await service.returnRedeemed(tx as never, order);

    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ points: 3, kind: 'REDEEM_RETURNED' }),
      }),
    );
    expect(tx.loyaltyAccount.update).toHaveBeenCalledWith({
      where: { userId: order.userId },
      data: { balance: { increment: 3 } },
    });
  });

  it('a SECOND return for the same order is a no-op — the balance goes up once', async () => {
    const tx = buildTx();
    tx.loyaltyTransaction.findUnique.mockResolvedValueOnce({ points: -3 });
    tx.loyaltyTransaction.create.mockRejectedValueOnce(duplicateKey());
    const service = new LoyaltyService({} as never);

    await service.returnRedeemed(tx as never, { id: newId(), userId: newId() });

    expect(tx.loyaltyAccount.update).not.toHaveBeenCalled();
  });
});

describe('LoyaltyService.reverse — edge cases', () => {
  it('a SECOND reversal for the same order is a no-op — the balance goes down once', async () => {
    const tx = buildTx();
    tx.loyaltyTransaction.findUnique.mockResolvedValueOnce({ points: 5 });
    tx.$queryRaw.mockResolvedValueOnce([{ balance: 12 }]);
    tx.loyaltyTransaction.create.mockRejectedValueOnce(duplicateKey());
    const service = new LoyaltyService({} as never);

    await service.reverse(tx as never, { id: newId(), userId: newId() });

    expect(tx.loyaltyAccount.update).not.toHaveBeenCalled();
  });

  it('a user with NO account row has nothing to remove — no row written', async () => {
    const tx = buildTx();
    tx.loyaltyTransaction.findUnique.mockResolvedValueOnce({ points: 5 });
    tx.$queryRaw.mockResolvedValueOnce([]); // the lock found no account
    const service = new LoyaltyService({} as never);

    await service.reverse(tx as never, { id: newId(), userId: newId() });

    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
    expect(tx.loyaltyAccount.update).not.toHaveBeenCalled();
  });
});
