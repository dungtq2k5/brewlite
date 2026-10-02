import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@brewlite/contracts';
import { CATALOG_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import { BaseGrpcClient, PROTO_LOADER_OPTIONS } from '@brewlite/nest-common';
import type {
  ListStaffProductsRequest,
  ListStaffProductsResponse,
  ReleaseStockRequest,
  ReleaseStockResponse,
  ReserveStockRequest,
  ReserveStockResponse,
  SetProductAvailabilityRequest,
  SetProductAvailabilityResponse,
  SetStockQtyRequest,
  SetStockQtyResponse,
  SetToppingAvailabilityRequest,
  SetToppingAvailabilityResponse,
} from '@brewlite/contracts/generated/brewlite/catalog/stock_service.js';
import { StockModule } from '../../src/modules/stock/stock.module.js';
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

@Module({ imports: [configModule, PrismaModule, StockModule] })
class RealStockModule {}

class TestStockClient extends BaseGrpcClient {
  constructor(url: string) {
    super({
      serviceName: 'brewlite.catalog.StockService',
      protoFiles: CATALOG_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url,
    });
  }

  listStaffProducts(request: ListStaffProductsRequest): Promise<ListStaffProductsResponse> {
    return this.call('listStaffProducts', request);
  }
  setProductAvailability(
    request: SetProductAvailabilityRequest,
  ): Promise<SetProductAvailabilityResponse> {
    return this.call('setProductAvailability', request);
  }
  setStockQty(request: SetStockQtyRequest): Promise<SetStockQtyResponse> {
    return this.call('setStockQty', request);
  }
  setToppingAvailability(
    request: SetToppingAvailabilityRequest,
  ): Promise<SetToppingAvailabilityResponse> {
    return this.call('setToppingAvailability', request);
  }
  reserveStock(request: ReserveStockRequest): Promise<ReserveStockResponse> {
    return this.call('reserveStock', request);
  }
  releaseStock(request: ReleaseStockRequest): Promise<ReleaseStockResponse> {
    return this.call('releaseStock', request);
  }
}

describe('StockService gRPC contract', () => {
  const url = 'localhost:25096';
  let app: Awaited<ReturnType<typeof NestFactory.createMicroservice>>;
  let client: TestStockClient;

  beforeAll(async () => {
    app = await NestFactory.createMicroservice<MicroserviceOptions>(RealStockModule, {
      transport: Transport.GRPC,
      options: {
        package: 'brewlite.catalog',
        protoPath: CATALOG_PROTO_FILES,
        url,
        loader: { ...PROTO_LOADER_OPTIONS, includeDirs: [PROTO_ROOT] },
      },
    });
    await app.listen();
    client = new TestStockClient(url);
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedProduct() {
    const category = await prisma.category.create({
      data: { id: newId(), nameEn: 'Coffee', nameVi: 'Cà phê' },
    });
    return prisma.product.create({
      data: {
        id: newId(),
        categoryId: category.id,
        nameEn: 'Iced milk coffee',
        nameVi: 'Cà phê sữa đá',
        basePriceVnd: 29_000,
      },
    });
  }

  it('completes a real ListStaffProducts round trip', async () => {
    await seedProduct();
    const res = await client.listStaffProducts({});
    expect(res.products.length).toBeGreaterThan(0);
  });

  it('completes a real SetProductAvailability round trip', async () => {
    const product = await seedProduct();
    const res = await client.setProductAvailability({ id: product.id, isAvailable: false });
    expect(res.product?.isAvailable).toBe(false);
  });

  it('completes a real SetStockQty round trip', async () => {
    const product = await seedProduct();
    const res = await client.setStockQty({ id: product.id, stockQty: 5, expectedVersion: 0 });
    expect(res.product?.stockQty).toBe(5);
    expect(res.product?.version).toBe(1);
  });

  it('completes a real SetToppingAvailability round trip', async () => {
    const topping = await prisma.topping.create({
      data: { id: newId(), nameEn: 'Pearls', nameVi: 'Trân châu', priceVnd: 8_000 },
    });
    const res = await client.setToppingAvailability({ id: topping.id, isAvailable: false });
    expect(res.topping?.isAvailable).toBe(false);
  });

  it('completes a real ReserveStock round trip, then ReleaseStock returns the stock', async () => {
    const product = await seedProduct();
    await prisma.product.update({ where: { id: product.id }, data: { stockQty: 5 } });
    const orderId = newId();

    const reserved = await client.reserveStock({
      orderId,
      lines: [{ productId: product.id, qty: 2 }],
    });
    expect(reserved.reservations).toHaveLength(1);
    expect(reserved.reservations[0]).toEqual({
      orderId,
      productId: product.id,
      qty: 2,
      status: 'HELD',
    });

    const released = await client.releaseStock({ orderId });
    expect(released.reservations[0]?.status).toBe('RELEASED');
  });
});
