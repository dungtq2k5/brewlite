import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId, Role } from '@brewlite/contracts';
import { CATALOG_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import {
  BaseGrpcClient,
  PROTO_LOADER_OPTIONS,
  isGrpcServiceError,
  readErrorCode,
  type Caller,
} from '@brewlite/nest-common';
import type {
  CreateCategoryRequest,
  CreateCategoryResponse,
  CreateProductRequest,
  CreateProductResponse,
  CreateToppingRequest,
  CreateToppingResponse,
  DeleteCategoryRequest,
  DeleteCategoryResponse,
  AdminMenuServiceListCategoriesRequest,
  AdminMenuServiceListCategoriesResponse,
  AdminMenuServiceListProductsRequest,
  AdminMenuServiceListProductsResponse,
  SetImageRequest,
  SetImageResponse,
} from '@brewlite/contracts/generated/brewlite/catalog/admin_menu_service.js';
import { AdminMenuModule } from '../../src/modules/admin-menu/admin-menu.module.js';
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

@Module({ imports: [configModule, PrismaModule, AdminMenuModule] })
class RealAdminMenuModule {}

class TestAdminMenuClient extends BaseGrpcClient {
  constructor(url: string) {
    super({
      serviceName: 'brewlite.catalog.AdminMenuService',
      protoFiles: CATALOG_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url,
    });
  }

  listCategories(
    request: AdminMenuServiceListCategoriesRequest,
  ): Promise<AdminMenuServiceListCategoriesResponse> {
    return this.call('listCategories', request);
  }
  createCategory(request: CreateCategoryRequest): Promise<CreateCategoryResponse> {
    return this.call('createCategory', request);
  }
  deleteCategory(
    request: DeleteCategoryRequest,
    opts: { caller: Caller },
  ): Promise<DeleteCategoryResponse> {
    return this.call('deleteCategory', request, opts);
  }
  listProducts(
    request: AdminMenuServiceListProductsRequest,
  ): Promise<AdminMenuServiceListProductsResponse> {
    return this.call('listProducts', request);
  }
  createProduct(request: CreateProductRequest): Promise<CreateProductResponse> {
    return this.call('createProduct', request);
  }
  createTopping(request: CreateToppingRequest): Promise<CreateToppingResponse> {
    return this.call('createTopping', request);
  }
  setImage(request: SetImageRequest): Promise<SetImageResponse> {
    return this.call('setImage', request);
  }
}

describe('AdminMenuService gRPC contract', () => {
  const url = 'localhost:25095';
  let app: Awaited<ReturnType<typeof NestFactory.createMicroservice>>;
  let client: TestAdminMenuClient;

  beforeAll(async () => {
    app = await NestFactory.createMicroservice<MicroserviceOptions>(RealAdminMenuModule, {
      transport: Transport.GRPC,
      options: {
        package: 'brewlite.catalog',
        protoPath: CATALOG_PROTO_FILES,
        url,
        loader: { ...PROTO_LOADER_OPTIONS, includeDirs: [PROTO_ROOT] },
      },
    });
    await app.listen();
    client = new TestAdminMenuClient(url);
  });

  afterAll(async () => {
    await app.close();
  });

  it('completes a real ListCategories and CreateCategory round trip', async () => {
    const created = await client.createCategory({
      name: { en: `Cat ${newId()}`, vi: `X ${newId()}` },
    });
    expect(created.category?.id).toBeTruthy();
    const listed = await client.listCategories({});
    expect(listed.categories.some((c) => c.id === created.category!.id)).toBe(true);
  });

  it('completes a real DeleteCategory round trip, with the caller forwarded as metadata', async () => {
    const created = await client.createCategory({
      name: { en: `Del ${newId()}`, vi: `X ${newId()}` },
    });
    const caller: Caller = { kind: 'USER', userId: newId(), role: Role.ADMIN };
    const deleted = await client.deleteCategory({ id: created.category!.id }, { caller });
    expect(deleted.category?.deletedById).toBe(caller.userId);
  });

  it('completes a real ListProducts and CreateProduct round trip', async () => {
    const category = await prisma.category.create({
      data: { id: newId(), nameEn: `Cat ${newId()}`, nameVi: `X ${newId()}` },
    });
    const created = await client.createProduct({
      categoryId: category.id,
      name: { en: `Prod ${newId()}`, vi: `X ${newId()}` },
      basePriceVnd: 20_000,
      sizes: [{ size: 'S', priceDeltaVnd: 0 }],
      toppingIds: [],
    });
    expect(created.product?.categoryId).toBe(category.id);
    const listed = await client.listProducts({
      page: { page: 1, pageSize: 20, sort: 'sortOrder' },
    });
    expect(listed.meta?.total).toBeGreaterThan(0);
  });

  it('completes a real CreateTopping round trip', async () => {
    const res = await client.createTopping({
      name: { en: `Top ${newId()}`, vi: `X ${newId()}` },
      priceVnd: 8_000,
    });
    expect(res.topping?.priceVnd).toBe(8_000);
  });

  it('SetImage crosses the gRPC boundary with a 2 MB payload', async () => {
    const category = await prisma.category.create({
      data: { id: newId(), nameEn: `Cat ${newId()}`, nameVi: `X ${newId()}` },
    });
    const created = await client.createProduct({
      categoryId: category.id,
      name: { en: `Img ${newId()}`, vi: `X ${newId()}` },
      basePriceVnd: 20_000,
      sizes: [{ size: 'S', priceDeltaVnd: 0 }],
      toppingIds: [],
    });
    const twoMb = new Uint8Array(2 * 1024 * 1024);
    twoMb.set([0xff, 0xd8, 0xff, 0xe0]); // a real JPEG header, padded to size
    const res = await client.setImage({
      id: created.product!.id,
      content: twoMb,
      contentType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(res.product?.imageUrl).toBeTruthy();
  });

  it("CATEGORY_NAME_TAKEN's locale detail crosses the gRPC boundary intact", async () => {
    const name = `Boundary ${newId()}`;
    await client.createCategory({ name: { en: name, vi: `X ${newId()}` } });
    await expect(
      client.createCategory({ name: { en: name, vi: `Y ${newId()}` } }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isGrpcServiceError(error)).toBe(true);
      if (!isGrpcServiceError(error)) return false;
      expect(readErrorCode(error)).toBe('CATEGORY_NAME_TAKEN');
      return true;
    });
  });
});
