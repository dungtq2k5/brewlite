import { Controller, UseInterceptors } from '@nestjs/common';
import type { Metadata } from '@grpc/grpc-js';
import { callerFrom, GrpcRequestContextInterceptor } from '@brewlite/nest-common';
import {
  OrderServiceControllerMethods,
  type BeginPaymentRequest,
  type BeginPaymentResponse,
  type CancelOrderRequest,
  type CancelOrderResponse,
  type GetOrderRequest,
  type GetOrderResponse,
  type GetOrderStatusRequest,
  type GetOrderStatusResponse,
  type ListMyOrdersRequest,
  type ListMyOrdersResponse,
  type OrderServiceController,
  type PlaceOrderRequest,
  type PlaceOrderResponse,
  type QuoteRequest,
  type QuoteResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/order_service.js';
import { OrdersService } from './orders.service.js';

@Controller()
@OrderServiceControllerMethods()
@UseInterceptors(GrpcRequestContextInterceptor)
export class OrderGrpcController implements OrderServiceController {
  constructor(private readonly orders: OrdersService) {}

  quote(request: QuoteRequest, metadata?: Metadata): Promise<QuoteResponse> {
    return this.orders.quote(request, callerFrom(metadata));
  }

  placeOrder(request: PlaceOrderRequest, metadata?: Metadata): Promise<PlaceOrderResponse> {
    return this.orders.placeOrder(request, callerFrom(metadata));
  }

  listMyOrders(request: ListMyOrdersRequest, metadata?: Metadata): Promise<ListMyOrdersResponse> {
    return this.orders.listMyOrders(request, callerFrom(metadata));
  }

  getOrder(request: GetOrderRequest, metadata?: Metadata): Promise<GetOrderResponse> {
    return this.orders.getOrder(request, callerFrom(metadata));
  }

  cancelOrder(request: CancelOrderRequest, metadata?: Metadata): Promise<CancelOrderResponse> {
    return this.orders.cancelOrder(request, callerFrom(metadata));
  }

  getOrderStatus(request: GetOrderStatusRequest): Promise<GetOrderStatusResponse> {
    return this.orders.getOrderStatus(request);
  }

  beginPayment(request: BeginPaymentRequest): Promise<BeginPaymentResponse> {
    return this.orders.beginPayment(request);
  }
}
