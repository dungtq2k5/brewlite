import { Controller, UseInterceptors } from '@nestjs/common';
import { GrpcRequestContextInterceptor } from '@brewlite/nest-common';
import {
  AdminOrderServiceControllerMethods,
  type AdminOrderServiceController,
  type GetAdminOrderRequest,
  type GetAdminOrderResponse,
  type ListOrdersRequest,
  type ListOrdersResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/admin_order_service.js';
import { AdminOrdersService } from './admin-orders.service.js';

@Controller()
@AdminOrderServiceControllerMethods()
@UseInterceptors(GrpcRequestContextInterceptor)
export class AdminOrderGrpcController implements AdminOrderServiceController {
  constructor(private readonly adminOrders: AdminOrdersService) {}

  listOrders(request: ListOrdersRequest): Promise<ListOrdersResponse> {
    return this.adminOrders.listOrders(request);
  }

  getAdminOrder(request: GetAdminOrderRequest): Promise<GetAdminOrderResponse> {
    return this.adminOrders.getAdminOrder(request);
  }
}
