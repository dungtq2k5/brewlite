import { describe, expect, it, vi } from 'vitest';
import { newId, Role } from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
import { OrdersService } from './orders.service.js';

function serviceError(code: number, blCode?: string) {
  return Object.assign(new Error('boom'), {
    code,
    metadata: {
      get: (key: string) => (key === 'bl-error-code' && blCode ? [blCode] : []),
    },
  });
}

function buildDeps() {
  const prisma = {
    order: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(),
  };
  const outbox = { add: vi.fn() };
  const catalogMenu = {
    priceItems: vi.fn().mockResolvedValue({
      lines: [
        {
          productId: newId(),
          productName: { en: 'Latte', vi: 'Latte' },
          size: 'S',
          basePriceVnd: 29_000,
          sizeDeltaVnd: 0,
          toppings: [],
          unitPriceVnd: 29_000,
          qty: 1,
          lineTotalVnd: 29_000,
        },
      ],
      subtotalVnd: '29000',
    }),
  };
  const catalogStock = { reserveStock: vi.fn().mockResolvedValue({}), releaseStock: vi.fn() };
  const promotions = { evaluate: vi.fn(), evaluateLocked: vi.fn() };
  const loyalty = { earn: vi.fn(), reverse: vi.fn() };
  return { prisma, outbox, catalogMenu, catalogStock, promotions, loyalty };
}

const caller: Caller = { kind: 'USER', userId: newId(), role: Role.CUSTOMER };

function buildRequest() {
  return {
    items: [{ productId: newId(), size: 'S', toppingIds: [], qty: 1 }],
    promoCode: undefined,
    note: undefined,
    idempotencyKey: newId(),
  };
}

describe('OrdersService.placeOrder — failure paths (catalog stubbed)', () => {
  it('a DB failure after ReserveStock calls ReleaseStock once, then rethrows', async () => {
    const deps = buildDeps();
    deps.prisma.$transaction.mockRejectedValueOnce(new Error('db exploded'));
    const orders = new OrdersService(
      deps.prisma as never,
      deps.outbox as never,
      deps.catalogMenu as never,
      deps.catalogStock as never,
      deps.promotions as never,
      deps.loyalty as never,
    );

    await expect(orders.placeOrder(buildRequest(), caller)).rejects.toThrow('db exploded');
    expect(deps.catalogStock.reserveStock).toHaveBeenCalledTimes(1);
    expect(deps.catalogStock.releaseStock).toHaveBeenCalledTimes(1);
  });

  it('a clean OUT_OF_STOCK refusal from ReserveStock never calls ReleaseStock', async () => {
    const deps = buildDeps();
    deps.catalogStock.reserveStock.mockRejectedValueOnce(serviceError(9, 'OUT_OF_STOCK'));
    const orders = new OrdersService(
      deps.prisma as never,
      deps.outbox as never,
      deps.catalogMenu as never,
      deps.catalogStock as never,
      deps.promotions as never,
      deps.loyalty as never,
    );

    await expect(orders.placeOrder(buildRequest(), caller)).rejects.toThrow();
    expect(deps.catalogStock.releaseStock).not.toHaveBeenCalled();
  });

  it('a ReserveStock timeout (DEADLINE_EXCEEDED) also calls ReleaseStock, then rethrows', async () => {
    const deps = buildDeps();
    deps.catalogStock.reserveStock.mockRejectedValueOnce(serviceError(4));
    const orders = new OrdersService(
      deps.prisma as never,
      deps.outbox as never,
      deps.catalogMenu as never,
      deps.catalogStock as never,
      deps.promotions as never,
      deps.loyalty as never,
    );

    await expect(orders.placeOrder(buildRequest(), caller)).rejects.toThrow();
    expect(deps.catalogStock.releaseStock).toHaveBeenCalledTimes(1);
    expect(deps.prisma.$transaction).not.toHaveBeenCalled();
  });
});
