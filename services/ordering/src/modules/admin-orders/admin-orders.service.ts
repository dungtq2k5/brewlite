import { Injectable } from '@nestjs/common';
import { businessDayRange } from '@brewlite/contracts';
import { rpcError } from '@brewlite/nest-common';
import type {
  GetAdminOrderRequest,
  GetAdminOrderResponse,
  ListOrdersRequest,
  ListOrdersResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/admin_order_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { toProtoOrder } from '../orders/order.mapper.js';
import { parseListOrders, toJsonPointer } from './domain/list-orders-query.js';

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  /**
   * Every customer's orders — no ownership scope; the gateway's `order.read.all` is the gate.
   * Filters combine with AND; `from`/`to` are business days (inclusive) on `created_at`.
   */
  async listOrders(request: ListOrdersRequest): Promise<ListOrdersResponse> {
    const parsed = parseListOrders({
      page: request.page,
      status: request.status,
      from: request.from,
      to: request.to,
      orderNo: request.orderNo,
      userId: request.userId,
    });
    if (!parsed.success) {
      throw rpcError('VALIDATION_FAILED', {
        issues: parsed.error.issues.map((issue) => ({
          path: toJsonPointer(issue.path),
          code: issue.code,
        })),
      });
    }
    const q = parsed.data;

    const createdAt: Prisma.DateTimeFilter = {};
    if (q.from !== undefined) createdAt.gte = businessDayRange(q.from, q.from).start;
    if (q.to !== undefined) createdAt.lt = businessDayRange(q.to, q.to).end;
    const where: Prisma.OrderWhereInput = {
      ...(q.status !== undefined && { status: q.status }),
      ...(q.orderNo !== undefined && { orderNo: BigInt(q.orderNo) }),
      ...(q.userId !== undefined && { userId: q.userId }),
      ...(Object.keys(createdAt).length > 0 && { createdAt }),
    };

    const direction = q.descending ? 'desc' : 'asc';
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: [{ [q.sortField]: direction }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    // One query for every row's lines, not one per row.
    const items = await this.prisma.orderItem.findMany({
      where: { orderId: { in: rows.map((r) => r.id) } },
      orderBy: [{ orderId: 'asc' }, { lineNo: 'asc' }],
    });
    const byOrder = new Map<string, typeof items>();
    for (const item of items) {
      const list = byOrder.get(item.orderId);
      if (list) list.push(item);
      else byOrder.set(item.orderId, [item]);
    }

    return {
      orders: rows.map((row) => toProtoOrder(row, byOrder.get(row.id) ?? [], [])),
      meta: { page: q.page, pageSize: q.pageSize, total },
    };
  }

  /** The order with its `history`; no ownership scope. */
  async getAdminOrder(request: GetAdminOrderRequest): Promise<GetAdminOrderResponse> {
    const exists = await this.prisma.order.findUnique({
      where: { id: request.id },
      select: { id: true },
    });
    if (!exists) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'ORDER' });
    return { order: await this.orders.toFullOrder(request.id) };
  }
}
