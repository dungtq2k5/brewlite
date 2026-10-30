import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CancelReason, newId, OrderRefundStatus, OrderStatus } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { ReportsModule } from '../../src/modules/reports/reports.module.js';
import { ReportsService } from '../../src/modules/reports/reports.service.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

async function buildModule() {
  const configModule = ConfigModule.forRoot({
    isGlobal: true,
    validate: () => envSchema.parse({ ...testEnv, DATABASE_URL: testEnv.DATABASE_URL_TEST }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, ReportsModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

function errorCode(exception: unknown): string | undefined {
  if (!(exception && typeof exception === 'object' && 'getError' in exception)) return undefined;
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  return metadata.get('bl-error-code')[0] as string | undefined;
}

interface Line {
  productId: string;
  nameEn: string;
  nameVi?: string;
  qty: number;
  lineTotalVnd: number;
}

/** A paid order at `paidAt`, with lines; the order's total is the lines' sum unless given. */
async function seedPaid(
  paidAt: string | null,
  lines: Line[],
  overrides: Record<string, unknown> = {},
) {
  const total = lines.reduce((sum, l) => sum + l.lineTotalVnd, 0);
  const order = await prisma.order.create({
    data: {
      id: newId(),
      userId: newId(),
      status: paidAt ? OrderStatus.PAID : OrderStatus.PENDING,
      subtotalVnd: total,
      totalVnd: total,
      idempotencyKey: newId(),
      requestHash: 'x'.repeat(64),
      expiresAt: new Date(Date.now() + 900_000),
      paidAt: paidAt ? new Date(paidAt) : null,
      ...overrides,
    },
  });
  for (const [i, l] of lines.entries()) {
    await prisma.orderItem.create({
      data: {
        id: newId(),
        orderId: order.id,
        lineNo: i + 1,
        productId: l.productId,
        productNameEn: l.nameEn,
        productNameVi: l.nameVi ?? l.nameEn,
        size: 'M',
        basePriceVnd: l.lineTotalVnd / l.qty,
        sizeDeltaVnd: 0,
        unitPriceVnd: l.lineTotalVnd / l.qty,
        qty: l.qty,
        lineTotalVnd: l.lineTotalVnd,
      },
    });
  }
  return order;
}

const latte = newId();
const tea = newId();

describe('ReportsService.salesReport', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let reports: ReportsService;

  beforeAll(async () => {
    app = await buildModule();
    reports = app.get(ReportsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('groups days in Vietnam time: 16:59:59Z and 17:00:00Z land on different days', async () => {
    await seedPaid('2026-10-20T16:59:59Z', [
      { productId: latte, nameEn: 'Latte', qty: 1, lineTotalVnd: 49_000 },
    ]);
    await seedPaid('2026-10-20T17:00:00Z', [
      { productId: latte, nameEn: 'Latte', qty: 1, lineTotalVnd: 51_000 },
    ]);
    const { days } = await reports.salesReport({ from: '2026-10-20', to: '2026-10-21' });
    expect(days).toEqual([
      { day: '2026-10-20', orders: 1, revenueVnd: '49000' },
      { day: '2026-10-21', orders: 1, revenueVnd: '51000' },
    ]);
  });

  it('is one row per business day of the range, zero days included, in order', async () => {
    await seedPaid('2026-10-12T05:00:00Z', [
      { productId: tea, nameEn: 'Tea', qty: 2, lineTotalVnd: 90_000 },
    ]);
    const { days } = await reports.salesReport({ from: '2026-10-10', to: '2026-10-14' });
    expect(days.map((d) => d.day)).toEqual([
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
    ]);
    expect(days.map((d) => [d.orders, d.revenueVnd])).toEqual([
      [0, '0'],
      [0, '0'],
      [1, '90000'],
      [0, '0'],
      [0, '0'],
    ]);
  });

  it('counts paid orders that are not refunded: a failed refund counts, a refunded one does not', async () => {
    const line = [{ productId: latte, nameEn: 'Latte', qty: 1, lineTotalVnd: 40_000 }];
    const at = '2026-10-15T05:00:00Z';
    // The table's CHECK ties CANCELLED to a time and a reason (O-1).
    const cancelled = {
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date(at),
      cancelReason: CancelReason.STAFF,
    };
    await seedPaid(at, line); // paid, refund NONE
    await seedPaid(at, line, { ...cancelled, refundStatus: OrderRefundStatus.FAILED }); // money kept
    await seedPaid(at, line, { ...cancelled, refundStatus: OrderRefundStatus.PENDING });
    await seedPaid(at, line, { ...cancelled, refundStatus: OrderRefundStatus.REFUNDED }); // gone
    await seedPaid(null, line); // never paid
    const { days, topProducts } = await reports.salesReport({
      from: '2026-10-15',
      to: '2026-10-15',
    });
    expect(days).toEqual([{ day: '2026-10-15', orders: 3, revenueVnd: '120000' }]);
    expect(topProducts).toEqual([
      expect.objectContaining({ productId: latte, qty: 3, revenueVnd: '120000' }),
    ]);
  });

  it('ranks top products by revenue, not quantity, with the most recent name', async () => {
    await seedPaid('2026-10-15T05:00:00Z', [
      { productId: latte, nameEn: 'Old Latte', nameVi: 'Latte cũ', qty: 1, lineTotalVnd: 40_000 },
      { productId: tea, nameEn: 'Tea', qty: 5, lineTotalVnd: 100_000 },
    ]);
    await seedPaid('2026-10-16T05:00:00Z', [
      { productId: latte, nameEn: 'Latte', nameVi: 'Latte mới', qty: 4, lineTotalVnd: 160_000 },
    ]);
    const { topProducts } = await reports.salesReport({ from: '2026-10-15', to: '2026-10-16' });
    expect(topProducts.map((p) => p.productId)).toEqual([latte, tea]); // 200k vs 100k
    expect(topProducts[0]).toMatchObject({
      qty: 5,
      revenueVnd: '200000',
      productName: { en: 'Latte', vi: 'Latte mới' },
    });
  });

  it('keeps only the top 10', async () => {
    const lines = Array.from({ length: 12 }, (_, i) => ({
      productId: newId(),
      nameEn: `P${i}`,
      qty: 1,
      lineTotalVnd: (i + 1) * 10_000,
    }));
    await seedPaid('2026-10-15T05:00:00Z', lines);
    const { topProducts } = await reports.salesReport({ from: '2026-10-15', to: '2026-10-15' });
    expect(topProducts).toHaveLength(10);
    expect(topProducts[0]!.revenueVnd).toBe('120000');
    expect(topProducts[9]!.revenueVnd).toBe('30000');
  });

  it('ignores orders outside the range', async () => {
    await seedPaid('2026-10-09T16:59:59Z', [
      { productId: tea, nameEn: 'Tea', qty: 1, lineTotalVnd: 20_000 },
    ]); // 9 Oct VN
    await seedPaid('2026-10-15T17:00:00Z', [
      { productId: tea, nameEn: 'Tea', qty: 1, lineTotalVnd: 20_000 },
    ]); // 16 Oct VN
    const { days, topProducts } = await reports.salesReport({
      from: '2026-10-10',
      to: '2026-10-15',
    });
    expect(days.every((d) => d.orders === 0)).toBe(true);
    expect(topProducts).toEqual([]);
  });

  it('allows 93 days and refuses 94, from after to, and a day that is not a day', async () => {
    const ok = await reports.salesReport({ from: '2026-07-01', to: '2026-10-01' });
    expect(ok.days).toHaveLength(93);
    for (const range of [
      { from: '2026-07-01', to: '2026-10-02' },
      { from: '2026-10-02', to: '2026-10-01' },
      { from: '2026-02-30', to: '2026-03-01' },
      { from: '', to: '2026-03-01' },
    ]) {
      const error = await reports.salesReport(range).catch((e: unknown) => e);
      expect(errorCode(error)).toBe('VALIDATION_FAILED');
    }
  });
});
