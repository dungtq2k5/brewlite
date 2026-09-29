import { Controller, UseInterceptors } from '@nestjs/common';
import { GrpcRequestContextInterceptor } from '@brewlite/nest-common';
import {
  StockServiceControllerMethods,
  type ListStaffProductsRequest,
  type ListStaffProductsResponse,
  type ReleaseStockRequest,
  type ReleaseStockResponse,
  type ReserveStockRequest,
  type ReserveStockResponse,
  type SetProductAvailabilityRequest,
  type SetProductAvailabilityResponse,
  type SetStockQtyRequest,
  type SetStockQtyResponse,
  type SetToppingAvailabilityRequest,
  type SetToppingAvailabilityResponse,
  type StockServiceController,
} from '@brewlite/contracts/generated/brewlite/catalog/stock_service.js';
import { StockService } from './stock.service.js';

@Controller()
@StockServiceControllerMethods()
@UseInterceptors(GrpcRequestContextInterceptor)
export class StockGrpcController implements StockServiceController {
  constructor(private readonly stock: StockService) {}

  listStaffProducts(request: ListStaffProductsRequest): Promise<ListStaffProductsResponse> {
    return this.stock.listStaffProducts(request);
  }

  setProductAvailability(
    request: SetProductAvailabilityRequest,
  ): Promise<SetProductAvailabilityResponse> {
    return this.stock.setProductAvailability(request);
  }

  setStockQty(request: SetStockQtyRequest): Promise<SetStockQtyResponse> {
    return this.stock.setStockQty(request);
  }

  setToppingAvailability(
    request: SetToppingAvailabilityRequest,
  ): Promise<SetToppingAvailabilityResponse> {
    return this.stock.setToppingAvailability(request);
  }

  reserveStock(request: ReserveStockRequest): Promise<ReserveStockResponse> {
    return this.stock.reserveStock(request);
  }

  releaseStock(request: ReleaseStockRequest): Promise<ReleaseStockResponse> {
    return this.stock.releaseStock(request);
  }
}
