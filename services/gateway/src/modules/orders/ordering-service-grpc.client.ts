import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient, type Caller } from '@brewlite/nest-common';
import { ORDERING_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import type {
  CancelOrderRequest,
  CancelOrderResponse,
  GetOrderRequest,
  GetOrderResponse,
  ListMyOrdersRequest,
  ListMyOrdersResponse,
  PlaceOrderRequest,
  PlaceOrderResponse,
  QuoteRequest,
  QuoteResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/order_service.js';
import type { Env } from '../../config/env.schema.js';

@Injectable()
export class OrderingServiceGrpcClient extends BaseGrpcClient {
  constructor(config: ConfigService<Env, true>) {
    super({
      serviceName: 'brewlite.ordering.OrderService',
      protoFiles: ORDERING_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url: config.get('ORDERING_GRPC_URL', { infer: true }),
    });
  }

  quote(caller: Caller, request: QuoteRequest, requestId?: string): Promise<QuoteResponse> {
    return this.call('quote', request, { requestId, caller });
  }

  placeOrder(
    caller: Caller,
    request: PlaceOrderRequest,
    requestId?: string,
  ): Promise<PlaceOrderResponse> {
    return this.call('placeOrder', request, { requestId, caller });
  }

  listMyOrders(
    caller: Caller,
    request: ListMyOrdersRequest,
    requestId?: string,
  ): Promise<ListMyOrdersResponse> {
    return this.call('listMyOrders', request, { requestId, caller });
  }

  getOrder(
    caller: Caller,
    request: GetOrderRequest,
    requestId?: string,
  ): Promise<GetOrderResponse> {
    return this.call('getOrder', request, { requestId, caller });
  }

  cancelOrder(
    caller: Caller,
    request: CancelOrderRequest,
    requestId?: string,
  ): Promise<CancelOrderResponse> {
    return this.call('cancelOrder', request, { requestId, caller });
  }
}
