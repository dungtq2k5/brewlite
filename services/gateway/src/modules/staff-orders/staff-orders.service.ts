import { Injectable } from '@nestjs/common';
import type { Caller } from '@brewlite/nest-common';
import type { UserContext } from '../../auth/request-context.js';
import { toOrderResponseDto } from '../orders/order.mapper.js';
import type { OrderResponseDto } from '../orders/dto/order.dto.js';
import { StaffOrdersGrpcClient } from './staff-orders-grpc.client.js';
import type { AdvanceStatusDto, CancelPaidDto, ListBoardQueryDto } from './dto/staff-order.dto.js';

function toCaller(ctx: UserContext): Caller {
  return { kind: 'USER', userId: ctx.userId, role: ctx.role };
}

@Injectable()
export class StaffOrdersService {
  constructor(private readonly staffOrders: StaffOrdersGrpcClient) {}

  async listBoard(
    query: ListBoardQueryDto,
    ctx: UserContext,
    requestId?: string,
  ): Promise<OrderResponseDto[]> {
    const response = await this.staffOrders.listBoard(
      toCaller(ctx),
      { status: query.status },
      requestId,
    );
    return response.orders.map(toOrderResponseDto);
  }

  async advanceStatus(
    id: string,
    dto: AdvanceStatusDto,
    ctx: UserContext,
    requestId?: string,
  ): Promise<OrderResponseDto> {
    const response = await this.staffOrders.advanceStatus(
      toCaller(ctx),
      { id, to: dto.to },
      requestId,
    );
    return toOrderResponseDto(response.order!);
  }

  async cancelPaid(
    id: string,
    dto: CancelPaidDto,
    ctx: UserContext,
    requestId?: string,
  ): Promise<OrderResponseDto> {
    const response = await this.staffOrders.cancelPaid(
      toCaller(ctx),
      { id, note: dto.note },
      requestId,
    );
    return toOrderResponseDto(response.order!);
  }
}
