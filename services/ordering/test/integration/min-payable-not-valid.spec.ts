import { describe, expect, it } from 'vitest';
import { newId } from '@brewlite/contracts';
import { prisma } from '../setup/per-file.js';

const order = (totalVnd: number) => ({
  id: newId(),
  userId: newId(),
  subtotalVnd: totalVnd,
  totalVnd,
  idempotencyKey: newId(),
  requestHash: 'x'.repeat(64),
  expiresAt: new Date(Date.now() + 900_000),
});

describe('orders_min_payable_ck is re-added NOT VALID on every deploy', () => {
  it('is not validated, so an older row below the minimum cannot fail a deploy', async () => {
    const [row] = await prisma.$queryRaw<{ convalidated: boolean }[]>`
      SELECT convalidated FROM pg_constraint WHERE conname = 'orders_min_payable_ck'`;
    expect(row?.convalidated).toBe(false);
  });

  it('still refuses a new row below 15,000 and accepts exactly 15,000', async () => {
    await expect(prisma.order.create({ data: order(14_999) })).rejects.toThrow();
    await expect(prisma.order.create({ data: order(15_000) })).resolves.toBeDefined();
  });
});
