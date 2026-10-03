import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient } from '@brewlite/nest-common';
import { CATALOG_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import type {
  PriceItemsRequest,
  PriceItemsResponse,
} from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import type { Env } from '../../config/env.schema.js';

@Injectable()
export class CatalogMenuGrpcClient extends BaseGrpcClient {
  constructor(config: ConfigService<Env, true>) {
    super({
      serviceName: 'brewlite.catalog.MenuService',
      protoFiles: CATALOG_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url: config.get('CATALOG_GRPC_URL', { infer: true }),
    });
  }

  priceItems(request: PriceItemsRequest, requestId?: string): Promise<PriceItemsResponse> {
    return this.call('priceItems', request, { requestId });
  }
}
