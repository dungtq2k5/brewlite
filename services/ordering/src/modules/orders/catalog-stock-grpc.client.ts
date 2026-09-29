import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient } from '@brewlite/nest-common';
import { CATALOG_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import type {
  ReleaseStockRequest,
  ReleaseStockResponse,
  ReserveStockRequest,
  ReserveStockResponse,
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

  reserveStock(request: ReserveStockRequest, requestId?: string): Promise<ReserveStockResponse> {
    return this.call('reserveStock', request, { requestId });
  }

  releaseStock(request: ReleaseStockRequest, requestId?: string): Promise<ReleaseStockResponse> {
    return this.call('releaseStock', request, { requestId });
  }
}
