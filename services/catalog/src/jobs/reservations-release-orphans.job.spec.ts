import { describe, expect, it, vi } from 'vitest';
import { newId, OrderStatus } from '@brewlite/contracts';
import { ReservationsReleaseOrphansJob } from './reservations-release-orphans.job.js';

function serviceError(blCode: string) {
  return Object.assign(new Error('boom'), {
    code: 5,
    metadata: { get: (key: string) => (key === 'bl-error-code' ? [blCode] : []) },
  });
}

function buildDeps() {
  const prisma = {
    stockReservation: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  };
  const stock = { releaseForOrder: vi.fn(), confirmForOrder: vi.fn() };
  const ordering = { getOrderStatus: vi.fn() };
  return { prisma, stock, ordering };
}

function build(deps: ReturnType<typeof buildDeps>) {
  return new ReservationsReleaseOrphansJob(
    deps.prisma as never,
    deps.stock as never,
    deps.ordering as never,
  );
}

describe('ReservationsReleaseOrphansJob', () => {
  it('RESOURCE_NOT_FOUND releases the reservation', async () => {
    const deps = buildDeps();
    const orderId = newId();
    deps.prisma.stockReservation.findMany.mockResolvedValueOnce([{ orderId }]);
    deps.ordering.getOrderStatus.mockRejectedValueOnce(serviceError('RESOURCE_NOT_FOUND'));

    await build(deps).run();

    expect(deps.stock.releaseForOrder).toHaveBeenCalledWith(orderId);
    expect(deps.stock.confirmForOrder).not.toHaveBeenCalled();
  });

  it('CANCELLED releases the reservation', async () => {
    const deps = buildDeps();
    const orderId = newId();
    deps.prisma.stockReservation.findMany.mockResolvedValueOnce([{ orderId }]);
    deps.ordering.getOrderStatus.mockResolvedValueOnce({ status: OrderStatus.CANCELLED });

    await build(deps).run();

    expect(deps.stock.releaseForOrder).toHaveBeenCalledWith(orderId);
  });

  it('PAID or later confirms the reservation', async () => {
    const deps = buildDeps();
    const orderId = newId();
    deps.prisma.stockReservation.findMany.mockResolvedValueOnce([{ orderId }]);
    deps.ordering.getOrderStatus.mockResolvedValueOnce({ status: OrderStatus.PREPARING });

    await build(deps).run();

    expect(deps.stock.confirmForOrder).toHaveBeenCalledWith(orderId);
    expect(deps.stock.releaseForOrder).not.toHaveBeenCalled();
  });

  it('still unpaid leaves the reservation alone', async () => {
    const deps = buildDeps();
    const orderId = newId();
    deps.prisma.stockReservation.findMany.mockResolvedValueOnce([{ orderId }]);
    deps.ordering.getOrderStatus.mockResolvedValueOnce({ status: OrderStatus.PENDING });

    await build(deps).run();

    expect(deps.stock.releaseForOrder).not.toHaveBeenCalled();
    expect(deps.stock.confirmForOrder).not.toHaveBeenCalled();
  });

  it('a failed GetOrderStatus call never guesses — the row is left for the next run', async () => {
    const deps = buildDeps();
    const orderId = newId();
    deps.prisma.stockReservation.findMany.mockResolvedValueOnce([{ orderId }]);
    deps.ordering.getOrderStatus.mockRejectedValueOnce(new Error('UNAVAILABLE'));

    await build(deps).run();

    expect(deps.stock.releaseForOrder).not.toHaveBeenCalled();
    expect(deps.stock.confirmForOrder).not.toHaveBeenCalled();
  });

  it('always prunes RELEASED rows older than 30 days, even with no orphans', async () => {
    const deps = buildDeps();
    await build(deps).run();
    expect(deps.prisma.stockReservation.deleteMany).toHaveBeenCalledOnce();
  });
});
