import { Controller, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CATALOG_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import {
  BaseGrpcClient,
  isGrpcServiceError,
  PROTO_LOADER_OPTIONS,
  readErrorCode,
  rpcError,
} from '@brewlite/nest-common';
import {
  MenuServiceControllerMethods,
  type ListCategoriesRequest,
  type ListCategoriesResponse,
  type MenuServiceController,
} from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import { MenuGrpcController } from '../../src/modules/menu/menu-grpc.controller.js';
import { MenuService } from '../../src/modules/menu/menu.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { envSchema } from '../../src/config/env.schema.js';
import { testEnv } from '../setup/env.js';

const configModule = ConfigModule.forRoot({
  isGlobal: true,
  validate: () => envSchema.parse(testEnv),
});

@Module({
  imports: [configModule, PrismaModule],
  controllers: [MenuGrpcController],
  providers: [MenuService],
})
class RealMenuModule {}

@Controller()
@MenuServiceControllerMethods()
class FailingMenuController implements MenuServiceController {
  listCategories(_request: ListCategoriesRequest): Promise<ListCategoriesResponse> {
    throw rpcError('INTERNAL');
  }
}

@Module({ controllers: [FailingMenuController] })
class FailingMenuModule {}

class TestMenuClient extends BaseGrpcClient {
  constructor(url: string) {
    super({
      serviceName: 'brewlite.catalog.MenuService',
      protoFiles: CATALOG_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url,
    });
  }

  listCategories(request: ListCategoriesRequest): Promise<ListCategoriesResponse> {
    return this.call('listCategories', request);
  }
}

async function startMicroservice(module: new () => object, url: string) {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(module, {
    transport: Transport.GRPC,
    options: {
      package: 'brewlite.catalog',
      protoPath: CATALOG_PROTO_FILES,
      url,
      loader: { ...PROTO_LOADER_OPTIONS, includeDirs: [PROTO_ROOT] },
    },
  });
  await app.listen();
  return app;
}

describe('MenuService gRPC contract', () => {
  const url = 'localhost:25099';
  let app: Awaited<ReturnType<typeof startMicroservice>>;
  let client: TestMenuClient;

  beforeAll(async () => {
    app = await startMicroservice(RealMenuModule, url);
    client = new TestMenuClient(url);
  });

  afterAll(async () => {
    await app.close();
  });

  it('completes a real ListCategories round trip', async () => {
    const res = await client.listCategories({});
    expect(res.categories).toEqual([]);
  });
});

describe('rpcError metadata crosses the gRPC boundary', () => {
  const url = 'localhost:25098';
  let app: Awaited<ReturnType<typeof startMicroservice>>;
  let client: TestMenuClient;

  beforeAll(async () => {
    app = await startMicroservice(FailingMenuModule, url);
    client = new TestMenuClient(url);
  });

  afterAll(async () => {
    await app.close();
  });

  it('arrives in the client ServiceError.metadata as bl-error-code', async () => {
    await expect(client.listCategories({})).rejects.toSatisfy((error: unknown) => {
      expect(isGrpcServiceError(error)).toBe(true);
      if (!isGrpcServiceError(error)) return false;
      expect(readErrorCode(error)).toBe('INTERNAL');
      return true;
    });
  });
});
