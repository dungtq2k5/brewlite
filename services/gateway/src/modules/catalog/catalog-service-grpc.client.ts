import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient } from '@brewlite/nest-common';
import { CATALOG_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import type {
  ListCategoriesRequest,
  ListCategoriesResponse,
} from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import type { Env } from '../../config/env.schema.js';

/** Returns the generated proto type only — never a DTO (conventions §2.2, §5.2). */
@Injectable()
export class CatalogServiceGrpcClient extends BaseGrpcClient {
  constructor(config: ConfigService<Env, true>) {
    super({
      serviceName: 'brewlite.catalog.MenuService',
      protoFiles: CATALOG_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url: config.get('CATALOG_GRPC_URL', { infer: true }),
    });
  }

  listCategories(
    request: ListCategoriesRequest,
    requestId?: string,
  ): Promise<ListCategoriesResponse> {
    return this.call('listCategories', request, { requestId });
  }
}
