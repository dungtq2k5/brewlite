import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId, Role } from '@brewlite/contracts';
import { ORDERING_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import {
  BaseGrpcClient,
  OutboxService,
  PROTO_LOADER_OPTIONS,
  type Caller,
} from '@brewlite/nest-common';
import type {
  CancelOrderRequest,
  CancelOrderResponse,
  GetOrderRequest,
  GetOrderResponse,
  ListMyOrdersRequest,
  ListMyOrdersResponse,
  PlaceOrderRequest,
  PlaceOrderResponse,
  QuoteRequest,
  QuoteResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/order_service.js';
import { envSchema } from '../../src/config/env.schema.js';
import { CatalogMenuGrpcClient } from '../../src/modules/orders/catalog-menu-grpc.client.js';
import { CatalogStockGrpcClient } from '../../src/modules/orders/catalog-stock-grpc.client.js';
import { OrderGrpcController } from '../../src/modules/orders/order-grpc.controller.js';
import { OrdersService } from '../../src/modules/orders/orders.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { PromotionsModule } from '../../src/modules/promotions/promotions.module.js';
import { LoyaltyModule } from '../../src/modules/loyalty/loyalty.module.js';
import { testEnv } from '../setup/env.js';

const OUT_OF_STOCK_PRODUCT_ID = newId();

function pricedLine(productId: string) {
  return {
    productId,
    productName: { en: 'Iced milk coffee', vi: 'Cà phê sữa đá' },
    size: 'S',
    basePriceVnd: 29_000,
    sizeDeltaVnd: 0,
    toppings: [],
    unitPriceVnd: 29_000,
    qty: 1,
    lineTotalVnd: 29_000,
  };
}

/** Mirrors exactly what a real catalog peer's `rpcError` produces on the wire. */
function serviceError(code: number, blCode: string, details: unknown) {
  const metadata = new Metadata();
  metadata.set('bl-error-code', blCode);
  metadata.set('bl-error-details-bin', Buffer.from(JSON.stringify(details), 'utf8'));
  return Object.assign(new Error(blCode), { code, metadata });
}

class FakeCatalogMenuGrpcClient {
  priceItems(request: { lines: { productId: string }[] }) {
    const lines = request.lines.map((l) => pricedLine(l.productId));
    const subtotalVnd = lines.reduce((sum, l) => sum + l.lineTotalVnd, 0);
    return Promise.resolve({ lines, subtotalVnd: String(subtotalVnd) });
  }
}

class FakeCatalogStockGrpcClient {
  reserveStock(request: { lines: { productId: string }[] }) {
    if (request.lines.some((l) => l.productId === OUT_OF_STOCK_PRODUCT_ID)) {
      return Promise.reject(
        serviceError(9, 'OUT_OF_STOCK', {
          products: [{ productId: OUT_OF_STOCK_PRODUCT_ID, available: 0 }],
        }),
      );
    }
    return Promise.resolve({ reservations: [] });
  }

  releaseStock() {
    return Promise.resolve({ reservations: [] });
  }
}

const configModule = ConfigModule.forRoot({
  isGlobal: true,
  validate: () =>
    envSchema.parse({
      ...testEnv,
      DATABASE_URL: testEnv.DATABASE_URL_TEST,
    }),
});

@Module({
  imports: [configModule, PrismaModule, PromotionsModule, LoyaltyModule],
  controllers: [OrderGrpcController],
  providers: [
    OrdersService,
    OutboxService,
    { provide: CatalogMenuGrpcClient, useClass: FakeCatalogMenuGrpcClient },
    { provide: CatalogStockGrpcClient, useClass: FakeCatalogStockGrpcClient },
  ],
})
class RealOrderModule {}

class TestOrderClient extends BaseGrpcClient {
  constructor(
    url: string,
    private readonly caller: Caller,
  ) {
    super({
      serviceName: 'brewlite.ordering.OrderService',
      protoFiles: ORDERING_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url,
    });
  }

  quote(request: QuoteRequest): Promise<QuoteResponse> {
    return this.call('quote', request, { caller: this.caller });
  }
  placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResponse> {
    return this.call('placeOrder', request, { caller: this.caller });
  }
  listMyOrders(request: ListMyOrdersRequest): Promise<ListMyOrdersResponse> {
    return this.call('listMyOrders', request, { caller: this.caller });
  }
  getOrder(request: GetOrderRequest): Promise<GetOrderResponse> {
    return this.call('getOrder', request, { caller: this.caller });
  }
  cancelOrder(request: CancelOrderRequest): Promise<CancelOrderResponse> {
    return this.call('cancelOrder', request, { caller: this.caller });
  }
}

describe('OrderService gRPC contract', () => {
  const url = 'localhost:25094';
  let app: Awaited<ReturnType<typeof NestFactory.createMicroservice>>;
  let client: TestOrderClient;

  beforeAll(async () => {
    app = await NestFactory.createMicroservice<MicroserviceOptions>(RealOrderModule, {
      transport: Transport.GRPC,
      options: {
        package: 'brewlite.ordering',
        protoPath: ORDERING_PROTO_FILES,
        url,
        loader: { ...PROTO_LOADER_OPTIONS, includeDirs: [PROTO_ROOT] },
      },
    });
    await app.listen();
    client = new TestOrderClient(url, { kind: 'USER', userId: newId(), role: Role.CUSTOMER });
  });

  afterAll(async () => {
    await app.close();
  });

  it('completes a real Quote round trip', async () => {
    const res = await client.quote({
      items: [{ productId: newId(), size: 'S', toppingIds: [], qty: 1 }],
    });
    expect(res.lines).toHaveLength(1);
    expect(res.subtotalVnd).toBe('29000');
  });

  it('completes a real PlaceOrder round trip', async () => {
    const res = await client.placeOrder({
      items: [{ productId: newId(), size: 'S', toppingIds: [], qty: 1 }],
      idempotencyKey: newId(),
    });
    expect(res.created).toBe(true);
    expect(res.order?.status).toBe('PENDING');
  });

  it('completes a real ListMyOrders round trip', async () => {
    await client.placeOrder({
      items: [{ productId: newId(), size: 'S', toppingIds: [], qty: 1 }],
      idempotencyKey: newId(),
    });
    const res = await client.listMyOrders({ limit: 20 });
    expect(res.orders.length).toBeGreaterThan(0);
  });

  it('completes a real GetOrder round trip', async () => {
    const placed = await client.placeOrder({
      items: [{ productId: newId(), size: 'S', toppingIds: [], qty: 1 }],
      idempotencyKey: newId(),
    });
    const res = await client.getOrder({ id: placed.order!.id });
    expect(res.order?.id).toBe(placed.order!.id);
  });

  it('completes a real CancelOrder round trip', async () => {
    const placed = await client.placeOrder({
      items: [{ productId: newId(), size: 'S', toppingIds: [], qty: 1 }],
      idempotencyKey: newId(),
    });
    const res = await client.cancelOrder({ id: placed.order!.id });
    expect(res.order?.status).toBe('CANCELLED');
  });

  it("OUT_OF_STOCK details from catalog arrive unchanged at the client through ordering's real gRPC transport — the error passes two hops", async () => {
    await expect(
      client.placeOrder({
        items: [{ productId: OUT_OF_STOCK_PRODUCT_ID, size: 'S', toppingIds: [], qty: 1 }],
        idempotencyKey: newId(),
      }),
    ).rejects.toSatisfy((error: unknown) => {
      const { metadata } = error as { metadata: Metadata };
      expect(metadata.get('bl-error-code')[0]).toBe('OUT_OF_STOCK');
      const [raw] = metadata.get('bl-error-details-bin');
      const details = JSON.parse(
        Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw),
      ) as unknown;
      expect(details).toEqual({ products: [{ productId: OUT_OF_STOCK_PRODUCT_ID, available: 0 }] });
      return true;
    });
  });
});
