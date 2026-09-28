import { Controller, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@brewlite/contracts';
import { CATALOG_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import {
  BaseGrpcClient,
  isGrpcServiceError,
  PROTO_LOADER_OPTIONS,
  readErrorCode,
  readErrorDetails,
  rpcError,
} from '@brewlite/nest-common';
import {
  MenuServiceControllerMethods,
  type GetProductRequest,
  type GetProductResponse,
  type ListCategoriesRequest,
  type ListCategoriesResponse,
  type ListProductsRequest,
  type ListProductsResponse,
  type MenuServiceController,
  type PriceItemsRequest,
  type PriceItemsResponse,
} from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import { MenuModule } from '../../src/modules/menu/menu.module.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { envSchema } from '../../src/config/env.schema.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

const configModule = ConfigModule.forRoot({
  isGlobal: true,
  validate: () =>
    envSchema.parse({
      ...testEnv,
      DATABASE_URL: testEnv.DATABASE_URL_TEST,
      REDIS_URL: testEnv.REDIS_URL_TEST,
    }),
});

@Module({
  imports: [configModule, PrismaModule, MenuModule],
})
class RealMenuModule {}

@Controller()
@MenuServiceControllerMethods()
class FailingMenuController implements MenuServiceController {
  listCategories(_request: ListCategoriesRequest): Promise<ListCategoriesResponse> {
    throw rpcError('INTERNAL');
  }
  listProducts(_request: ListProductsRequest): Promise<ListProductsResponse> {
    throw rpcError('INTERNAL');
  }
  getProduct(_request: GetProductRequest): Promise<GetProductResponse> {
    throw rpcError('RESOURCE_NOT_FOUND', { resource: 'PRODUCT' });
  }
  priceItems(_request: PriceItemsRequest): Promise<PriceItemsResponse> {
    throw rpcError('OUT_OF_STOCK', { products: [{ productId: newId(), available: 0 }] });
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

  listProducts(request: ListProductsRequest): Promise<ListProductsResponse> {
    return this.call('listProducts', request);
  }

  getProduct(request: GetProductRequest): Promise<GetProductResponse> {
    return this.call('getProduct', request);
  }

  priceItems(request: PriceItemsRequest): Promise<PriceItemsResponse> {
    return this.call('priceItems', request);
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

  it('completes a real ListProducts round trip', async () => {
    const category = await prisma.category.create({
      data: { id: newId(), nameEn: 'Coffee', nameVi: 'Cà phê' },
    });
    await prisma.product.create({
      data: {
        id: newId(),
        categoryId: category.id,
        nameEn: 'Iced milk coffee',
        nameVi: 'Cà phê sữa đá',
        basePriceVnd: 29_000,
        sizes: { create: [{ size: 'S', priceDeltaVnd: 0 }] },
      },
    });
    const res = await client.listProducts({});
    expect(res.products).toHaveLength(1);
  });

  it('completes a real GetProduct round trip', async () => {
    const category = await prisma.category.create({
      data: { id: newId(), nameEn: 'Coffee', nameVi: 'Cà phê' },
    });
    const product = await prisma.product.create({
      data: {
        id: newId(),
        categoryId: category.id,
        nameEn: 'Iced milk coffee',
        nameVi: 'Cà phê sữa đá',
        basePriceVnd: 29_000,
        sizes: { create: [{ size: 'S', priceDeltaVnd: 0 }] },
      },
    });
    const res = await client.getProduct({ id: product.id });
    expect(res.product?.summary?.id).toBe(product.id);
  });

  it('completes a real PriceItems round trip', async () => {
    const category = await prisma.category.create({
      data: { id: newId(), nameEn: 'Coffee', nameVi: 'Cà phê' },
    });
    const product = await prisma.product.create({
      data: {
        id: newId(),
        categoryId: category.id,
        nameEn: 'Iced milk coffee',
        nameVi: 'Cà phê sữa đá',
        basePriceVnd: 29_000,
        sizes: { create: [{ size: 'S', priceDeltaVnd: 0 }] },
      },
    });
    const res = await client.priceItems({
      lines: [{ productId: product.id, size: 'S', toppingIds: [], qty: 1 }],
    });
    expect(res.subtotalVnd).toBe('29000');
  });

  it('a subtotal_vnd above 2³¹ survives as a string', async () => {
    const category = await prisma.category.create({
      data: { id: newId(), nameEn: 'Coffee', nameVi: 'Cà phê' },
    });
    const toppings = await Promise.all(
      [1, 2, 3].map((n) =>
        prisma.topping.create({
          data: {
            id: newId(),
            nameEn: `Topping ${n}`,
            nameVi: `Topping ${n}`,
            priceVnd: 10_000_000,
          },
        }),
      ),
    );
    const product = await prisma.product.create({
      data: {
        id: newId(),
        categoryId: category.id,
        nameEn: 'Max price product',
        nameVi: 'Sản phẩm giá tối đa',
        basePriceVnd: 10_000_000,
        sizes: { create: [{ size: 'L', priceDeltaVnd: 10_000_000 }] },
        toppings: { create: toppings.map((t) => ({ toppingId: t.id })) },
      },
    });
    const line = {
      productId: product.id,
      size: 'L',
      toppingIds: toppings.map((t) => t.id),
      qty: 10,
    };
    const res = await client.priceItems({ lines: Array(5).fill(line) });
    const subtotal = BigInt(res.subtotalVnd);
    expect(subtotal).toBeGreaterThan(2n ** 31n);
    expect(typeof res.subtotalVnd).toBe('string');
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

  it("OUT_OF_STOCK's details.products arrive intact through bl-error-details-bin", async () => {
    await expect(
      client.priceItems({ lines: [{ productId: newId(), size: 'S', toppingIds: [], qty: 1 }] }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isGrpcServiceError(error)).toBe(true);
      if (!isGrpcServiceError(error)) return false;
      expect(readErrorCode(error)).toBe('OUT_OF_STOCK');
      const details = readErrorDetails(error) as {
        products: { productId: string; available: number }[];
      };
      expect(details.products).toHaveLength(1);
      expect(details.products[0]?.available).toBe(0);
      return true;
    });
  });
});
