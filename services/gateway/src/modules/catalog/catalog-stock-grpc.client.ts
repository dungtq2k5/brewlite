import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient } from '@brewlite/nest-common';
import { CATALOG_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import type {
  ListStaffProductsRequest,
  ListStaffProductsResponse,
  SetProductAvailabilityRequest,
  SetProductAvailabilityResponse,
  SetStockQtyRequest,
  SetStockQtyResponse,
  SetToppingAvailabilityRequest,
  SetToppingAvailabilityResponse,
} from '@brewlite/contracts/generated/brewlite/catalog/stock_service.js';
import type { Env } from '../../config/env.schema.js';

@Injectable()
export class CatalogStockGrpcClient extends BaseGrpcClient {
  constructor(config: ConfigService<Env, true>) {
    super({
      serviceName: 'brewlite.catalog.StockService',
      protoFiles: CATALOG_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url: config.get('CATALOG_GRPC_URL', { infer: true }),
    });
  }

  listStaffProducts(
    request: ListStaffProductsRequest,
    requestId?: string,
  ): Promise<ListStaffProductsResponse> {
    return this.call('listStaffProducts', request, { requestId });
  }

  setProductAvailability(
    request: SetProductAvailabilityRequest,
    requestId?: string,
  ): Promise<SetProductAvailabilityResponse> {
    return this.call('setProductAvailability', request, { requestId });
  }

  setStockQty(request: SetStockQtyRequest, requestId?: string): Promise<SetStockQtyResponse> {
    return this.call('setStockQty', request, { requestId });
  }

  setToppingAvailability(
    request: SetToppingAvailabilityRequest,
    requestId?: string,
  ): Promise<SetToppingAvailabilityResponse> {
    return this.call('setToppingAvailability', request, { requestId });
  }
}
