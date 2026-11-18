import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { describe, expect, it, vi } from 'vitest';
import { newId, OrderStatus, PaymentFailureReason, PaymentMethod, Role } from '@brewlite/contracts';
import { localErrorCode, rpcError, type Caller } from '@brewlite/nest-common';
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

function buildService(deps: ReturnType<typeof buildDeps>) {
  return new OrdersService(
    deps.prisma as never,
    deps.outbox as never,
    deps.catalogMenu as never,
    deps.catalogStock as never,
    deps.promotions as never,
    deps.loyalty as never,
  );
}

/** A catalog refusal as it arrives over the wire: a gRPC status, a `bl-error-code` and details. */
function catalogRefusal(code: number, blCode: string, details: unknown) {
  return Object.assign(new Error(blCode), {
    code,
    metadata: {
      get: (key: string) =>
        key === 'bl-error-code'
          ? [blCode]
          : key === 'bl-error-details-bin'
            ? [Buffer.from(JSON.stringify(details), 'utf8')]
            : [],
    },
  });
}

describe('OrdersService.placeOrder — pricing and release failures (catalog stubbed)', () => {
  it('a PriceItems refusal crosses as ordering’s own error, code and details kept — nothing reserved', async () => {
    const deps = buildDeps();
    const productIds = [newId()];
    deps.catalogMenu.priceItems.mockRejectedValueOnce(
      catalogRefusal(9, 'PRODUCT_UNAVAILABLE', { productIds }),
    );

    const error = await buildService(deps)
      .placeOrder(buildRequest(), caller)
      .catch((e: unknown) => e);

    expect(localErrorCode(error)).toBe('PRODUCT_UNAVAILABLE');
    const metadata = (error as RpcException).getError() as { metadata: Metadata };
    const details = metadata.metadata.get('bl-error-details-bin')[0] as Buffer;
    expect(JSON.parse(details.toString('utf8'))).toEqual({ productIds });
    expect(deps.catalogStock.reserveStock).not.toHaveBeenCalled();
  });

  it('a PriceItems outage (UNAVAILABLE, no bl-error-code) is rethrown AS-IS', async () => {
    const deps = buildDeps();
    const outage = serviceError(14);
    deps.catalogMenu.priceItems.mockRejectedValueOnce(outage);

    await expect(buildService(deps).placeOrder(buildRequest(), caller)).rejects.toBe(outage);
    expect(deps.catalogStock.reserveStock).not.toHaveBeenCalled();
  });

  it('a failing ReleaseStock never hides the DB error that triggered it', async () => {
    const deps = buildDeps();
    deps.prisma.$transaction.mockRejectedValueOnce(new Error('db exploded'));
    deps.catalogStock.releaseStock.mockRejectedValueOnce(serviceError(14));

    await expect(buildService(deps).placeOrder(buildRequest(), caller)).rejects.toThrow(
      'db exploded',
    );
    expect(deps.catalogStock.releaseStock).toHaveBeenCalledTimes(1);
  });
});

describe('OrdersService.beginPayment — the PENDING conditional write loses a race', () => {
  it('refuses ORDER_NOT_PAYABLE with the status the order moved to', async () => {
    const deps = buildDeps();
    const prisma = {
      ...deps.prisma,
      order: {
        findFirst: vi.fn().mockResolvedValue({
          orderNo: 1001n,
          totalVnd: 50_000,
          status: OrderStatus.PENDING,
          expiresAt: new Date(Date.now() + 60_000),
        }),
        // The expiry job committed between the read and the write.
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirstOrThrow: vi.fn().mockResolvedValue({ status: OrderStatus.CANCELLED }),
      },
    };
    const orders = buildService({ ...deps, prisma: prisma as never });

    const error = await orders
      .beginPayment({ orderId: newId(), userId: newId(), paymentId: newId() })
      .catch((e: unknown) => e);

    expect(localErrorCode(error)).toBe('ORDER_NOT_PAYABLE');
    expect(prisma.order.findFirstOrThrow).toHaveBeenCalledOnce();
  });
});

describe('OrdersService.applyPaymentSucceeded — the conditional write loses a race', () => {
  function raceDeps(freshStatus: OrderStatus, transactionError: unknown) {
    const deps = buildDeps();
    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: newId(),
          userId: newId(),
          status: OrderStatus.PENDING,
          totalVnd: 50_000,
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ status: freshStatus }),
      },
      // The first transaction (the PAID write) fails; any later one (the rejection) runs.
      $transaction: vi
        .fn()
        .mockRejectedValueOnce(transactionError)
        .mockImplementation((fn: (tx: unknown) => unknown) => fn({})),
    };
    return {
      ...deps,
      prisma: prisma as never as ReturnType<typeof buildDeps>['prisma'],
      reads: prisma.order,
    };
  }

  const payload = () => ({
    eventId: newId(),
    occurredAt: new Date().toISOString(),
    paymentId: newId(),
    orderId: newId(),
    userId: newId(),
    amountVnd: 50_000,
    method: PaymentMethod.FAKE,
  });

  it('the expiry won — the order is CANCELLED, so the payment is rejected through the outbox', async () => {
    const deps = raceDeps(
      OrderStatus.CANCELLED,
      rpcError('INVALID_STATE', { status: 'CANCELLED' }),
    );
    const event = payload();

    await buildService(deps).applyPaymentSucceeded(event);

    expect(deps.outbox.add).toHaveBeenCalledWith(
      {},
      'ordering.payment.rejected',
      expect.any(String),
      {
        orderId: expect.any(String),
        paymentId: event.paymentId,
        orderStatus: OrderStatus.CANCELLED,
      },
    );
  });

  it('INVALID_STATE but the order is NOT cancelled — rethrown, nothing rejected', async () => {
    const refusal = rpcError('INVALID_STATE', { status: 'PREPARING' });
    const deps = raceDeps(OrderStatus.PREPARING, refusal);

    await expect(buildService(deps).applyPaymentSucceeded(payload())).rejects.toBe(refusal);
    expect(deps.outbox.add).not.toHaveBeenCalled();
  });

  it('any other failure is rethrown without re-reading the order', async () => {
    const deps = raceDeps(OrderStatus.CANCELLED, new Error('connection lost'));

    await expect(buildService(deps).applyPaymentSucceeded(payload())).rejects.toThrow(
      'connection lost',
    );
    expect(deps.reads.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(deps.outbox.add).not.toHaveBeenCalled();
  });
});

describe('OrdersService.applyPaymentFailed', () => {
  it('an unexpected failure is rethrown, so the consumer naks and retries', async () => {
    const deps = buildDeps();
    deps.prisma.$transaction.mockRejectedValueOnce(new Error('connection lost'));

    await expect(
      buildService(deps).applyPaymentFailed({
        eventId: newId(),
        occurredAt: new Date().toISOString(),
        paymentId: newId(),
        orderId: newId(),
        reason: PaymentFailureReason.SIMULATED,
      }),
    ).rejects.toThrow('connection lost');
  });
});
