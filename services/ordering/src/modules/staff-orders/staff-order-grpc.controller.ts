import { Controller, UseInterceptors } from '@nestjs/common';
import type { Metadata } from '@grpc/grpc-js';
import { callerFrom, GrpcRequestContextInterceptor } from '@brewlite/nest-common';
import {
  StaffOrderServiceControllerMethods,
  type AdvanceStatusRequest,
  type AdvanceStatusResponse,
  type CancelPaidRequest,
  type CancelPaidResponse,
  type ListBoardRequest,
  type ListBoardResponse,
  type StaffOrderServiceController,
} from '@brewlite/contracts/generated/brewlite/ordering/staff_order_service.js';
import { StaffOrdersService } from './staff-orders.service.js';

@Controller()
@StaffOrderServiceControllerMethods()
@UseInterceptors(GrpcRequestContextInterceptor)
export class StaffOrderGrpcController implements StaffOrderServiceController {
  constructor(private readonly staffOrders: StaffOrdersService) {}

  listBoard(request: ListBoardRequest): Promise<ListBoardResponse> {
    return this.staffOrders.listBoard(request);
  }

  advanceStatus(
    request: AdvanceStatusRequest,
    metadata?: Metadata,
  ): Promise<AdvanceStatusResponse> {
    return this.staffOrders.advanceStatus(request, callerFrom(metadata));
  }

  cancelPaid(request: CancelPaidRequest, metadata?: Metadata): Promise<CancelPaidResponse> {
    return this.staffOrders.cancelPaid(request, callerFrom(metadata));
  }
}
