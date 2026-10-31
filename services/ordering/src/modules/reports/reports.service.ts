import { Injectable } from '@nestjs/common';
import {
  businessDayRange,
  listBusinessDays,
  OrderActorType,
  OrderStatus,
} from '@brewlite/contracts';
import { rpcError } from '@brewlite/nest-common';
import type {
  GetStaffStatsRequest,
  GetStaffStatsResponse,
  SalesReportRequest,
  SalesReportResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/report_service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseSalesRange, parseStaffStats } from './domain/sales-range.js';

/** The report shows this many products (api-endpoints-plan §3.4; the MVP's answer to "top N"). */
const TOP_PRODUCTS = 10;

interface DayRow {
  day: string;
  orders: number;
  revenue_vnd: bigint;
}
interface TopRow {
  product_id: string;
  qty: number;
  revenue_vnd: bigint;
  name_en: string;
  name_vi: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Orders that reached `PAID` and were not refunded: `paid_at IS NOT NULL AND refund_status <>
   * 'REFUNDED'`. `paid_at` is set once, on `PAID`, and kept — so a staff-cancelled order whose
   * refund failed still counts (the money was kept) and a refunded one does not.
   */
  async salesReport(request: SalesReportRequest): Promise<SalesReportResponse> {
    const parsed = parseSalesRange(request);
    if (!parsed.ok) throw rpcError('VALIDATION_FAILED', { issues: parsed.issues });
    const { from, to } = parsed.range;
    const { start, end } = businessDayRange(from, to);

    // Days are grouped in the database, in Vietnam time — raw SQL with physical names, and an
    // integration test that puts orders on both sides of Vietnam midnight (conventions §7.8).
    const [dayRows, topRows] = await Promise.all([
      this.prisma.$queryRaw<DayRow[]>`
        SELECT to_char(date_trunc('day', paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS orders,
               SUM(total_vnd)::bigint AS revenue_vnd
          FROM orders
         WHERE paid_at >= ${start} AND paid_at < ${end}
           AND refund_status <> 'REFUNDED'
         GROUP BY 1
         ORDER BY 1`,
      this.prisma.$queryRaw<TopRow[]>`
        SELECT oi.product_id,
               SUM(oi.qty)::int AS qty,
               SUM(oi.line_total_vnd)::bigint AS revenue_vnd,
               (ARRAY_AGG(oi.product_name_en ORDER BY o.paid_at DESC, oi.id DESC))[1] AS name_en,
               (ARRAY_AGG(oi.product_name_vi ORDER BY o.paid_at DESC, oi.id DESC))[1] AS name_vi
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
         WHERE o.paid_at >= ${start} AND o.paid_at < ${end}
           AND o.refund_status <> 'REFUNDED'
         GROUP BY oi.product_id
         ORDER BY revenue_vnd DESC, oi.product_id ASC
         LIMIT ${TOP_PRODUCTS}`,
    ]);

    const byDay = new Map(dayRows.map((row) => [row.day, row]));
    return {
      // One row per business day of the range; a day with no sale is zeros.
      days: listBusinessDays(from, to).map((day) => ({
        day,
        orders: byDay.get(day)?.orders ?? 0,
        revenueVnd: (byDay.get(day)?.revenue_vnd ?? 0n).toString(),
      })),
      topProducts: topRows.map((row) => ({
        productId: row.product_id,
        productName: { en: row.name_en, vi: row.name_vi },
        qty: row.qty,
        revenueVnd: row.revenue_vnd.toString(),
      })),
    };
  }

  /**
   * What O-3 answers exactly: the `STAFF` rows of one user in the range — orders handled (distinct)
   * and the transitions by status. Anyone who moved an order has numbers (an admin at the counter
   * is recorded as `STAFF` too); a customer, or a user who moved nothing, has zeros.
   */
  async getStaffStats(request: GetStaffStatsRequest): Promise<GetStaffStatsResponse> {
    const parsed = parseStaffStats(request);
    if (!parsed.ok) throw rpcError('VALIDATION_FAILED', { issues: parsed.issues });
    const { from, to } = parsed.range;
    const { start, end } = businessDayRange(from, to);
    const where = {
      actorType: OrderActorType.STAFF,
      actorUserId: parsed.userId,
      createdAt: { gte: start, lt: end },
    };

    const [byStatus, orders] = await Promise.all([
      this.prisma.orderStatusHistory.groupBy({ by: ['toStatus'], where, _count: { _all: true } }),
      // ponytail: one row per handled order; a counter's volume, switch to COUNT(DISTINCT) in SQL if it grows
      this.prisma.orderStatusHistory.groupBy({ by: ['orderId'], where }),
    ]);
    const count = (status: OrderStatus) =>
      byStatus.find((row) => row.toStatus === status)?._count._all ?? 0;
    return {
      from,
      to,
      ordersHandled: orders.length,
      transitions: {
        preparing: count(OrderStatus.PREPARING),
        ready: count(OrderStatus.READY),
        completed: count(OrderStatus.COMPLETED),
        cancelled: count(OrderStatus.CANCELLED),
      },
    };
  }
}
