import { Injectable } from '@nestjs/common';
import { localErrorCode, requireUser, rpcError, type Caller } from '@brewlite/nest-common';
import {
  CancelReason,
  OrderActorType,
  OrderStatus,
  OrderRefundStatus,
  STAFF_BOARD_MAX_ORDERS,
  STAFF_BOARD_STATUSES,
} from '@brewlite/contracts';
import type {
  AdvanceStatusRequest,
  AdvanceStatusResponse,
  CancelPaidRequest,
  CancelPaidResponse,
  ListBoardRequest,
  ListBoardResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/staff_order_service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { toProtoOrder } from '../orders/order.mapper.js';

@Injectable()
export class StaffOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  /** No ownership scope — the board is every customer's orders; the gateway's permission is the gate. */
  async listBoard(request: ListBoardRequest): Promise<ListBoardResponse> {
    const rows = await this.prisma.order.findMany({
      where: { status: request.status ?? { in: [...STAFF_BOARD_STATUSES] } },
      orderBy: { id: 'asc' },
      take: STAFF_BOARD_MAX_ORDERS,
    });
    const orders = await Promise.all(
      rows.map(async (row) => {
        const items = await this.prisma.orderItem.findMany({
          where: { orderId: row.id },
          orderBy: { lineNo: 'asc' },
        });
        return toProtoOrder(row, items, []);
      }),
    );
    return { orders };
  }

  /** The state machine and the conditional update already are the rule — nothing extra here. */
  async advanceStatus(
    request: AdvanceStatusRequest,
    caller: Caller,
  ): Promise<AdvanceStatusResponse> {
    const { userId } = requireUser(caller);
    await this.prisma.$transaction((tx) =>
      this.orders.transition(tx, request.id, {}, request.to as OrderStatus, {
        type: OrderActorType.STAFF,
        userId,
      }),
    );
    return { order: await this.orders.toFullOrder(request.id) };
  }

  async cancelPaid(request: CancelPaidRequest, caller: Caller): Promise<CancelPaidResponse> {
    const { userId } = requireUser(caller);
    const current = await this.prisma.order.findUnique({
      where: { id: request.id },
      select: { status: true },
    });
    if (!current) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'ORDER' });
    if (current.status !== OrderStatus.PAID) {
      throw rpcError('INVALID_STATE', { status: current.status });
    }

    try {
      await this.prisma.$transaction((tx) =>
        this.orders.transition(
          tx,
          request.id,
          { status: OrderStatus.PAID },
          OrderStatus.CANCELLED,
          { type: OrderActorType.STAFF, userId },
          {
            cancelledAt: new Date(),
            cancelReason: CancelReason.STAFF,
            cancelNote: request.note,
            refundStatus: OrderRefundStatus.PENDING,
          },
          request.note,
        ),
      );
    } catch (error) {
      // The order left PAID between the read above and the conditional write.
      if (localErrorCode(error) !== 'RESOURCE_NOT_FOUND') throw error;
      const fresh = await this.prisma.order.findUniqueOrThrow({
        where: { id: request.id },
        select: { status: true },
      });
      throw rpcError('INVALID_STATE', { status: fresh.status });
    }
    return { order: await this.orders.toFullOrder(request.id) };
  }
}
