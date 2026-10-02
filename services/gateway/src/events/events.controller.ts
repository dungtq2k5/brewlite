import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Auth, RateLimit, RequirePermission, SkipEnvelope } from '@brewlite/nest-common';
import { OrderStatus } from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
import { Ctx, type UserContext } from '../auth/request-context.js';
import { OrderIdParamDto } from '../modules/orders/dto/order-id-param.dto.js';
import { OrderingServiceGrpcClient } from '../modules/orders/ordering-service-grpc.client.js';
import { SseStreams } from './sse-streams.service.js';

const TERMINAL: ReadonlySet<OrderStatus> = new Set([OrderStatus.COMPLETED, OrderStatus.CANCELLED]);

function toCaller(ctx: UserContext): Caller {
  return { kind: 'USER', userId: ctx.userId, role: ctx.role };
}

/**
 * Both routes own the response (`@Res()`): no envelope, no rate-limit class (api §0.8),
 * and out of OpenAPI — the generated client cannot consume a stream.
 */
@Controller()
export class EventsController {
  constructor(
    private readonly streams: SseStreams,
    private readonly ordering: OrderingServiceGrpcClient,
  ) {}

  /** Ownership is checked once, at connect — someone else's order is a JSON 404 before any stream starts. */
  @Get('orders/:id/events')
  @Auth('USER')
  @RateLimit('NONE')
  @SkipEnvelope()
  @ApiExcludeEndpoint()
  async orderEvents(
    @Param() params: OrderIdParamDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { order } = await this.ordering.getOrder(
      toCaller(ctx),
      { id: params.id },
      req.id as string | undefined,
    );
    // A `204` is final for EventSource; ending a `200` would make the browser reconnect forever.
    if (TERMINAL.has(order!.status as OrderStatus)) {
      res.status(204).end();
      return;
    }
    this.streams.attach(req, res, {
      accepts: (frame) => frame.orderId === params.id,
      endAfter: TERMINAL,
    });
  }

  @Get('staff/orders/events')
  @RequirePermission('order.board.read')
  @RateLimit('NONE')
  @SkipEnvelope()
  @ApiExcludeEndpoint()
  staffEvents(@Req() req: Request, @Res() res: Response): void {
    this.streams.attach(req, res, { accepts: () => true });
  }
}
