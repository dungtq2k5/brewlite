import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { vi } from 'vitest';
import { envSchema } from '../../../src/config/env.schema.js';
import { CatalogMenuGrpcClient } from '../../../src/modules/orders/catalog-menu-grpc.client.js';
import { CatalogStockGrpcClient } from '../../../src/modules/orders/catalog-stock-grpc.client.js';
import { OrdersModule } from '../../../src/modules/orders/orders.module.js';
import { PrismaModule } from '../../../src/modules/prisma/prisma.module.js';
import { OrdersExpireJob } from '../../../src/jobs/orders-expire.job.js';
import { testEnv } from '../../setup/env.js';

/** What catalog's `PriceItems` returns for one line — the stub's unit price, size S, no toppings. */
export function pricedLine(productId: string, priceVnd: number) {
  return {
    productId,
    productName: { en: 'Iced milk coffee', vi: 'Cà phê sữa đá' },
    size: 'S',
    basePriceVnd: priceVnd,
    sizeDeltaVnd: 0,
    toppings: [],
    unitPriceVnd: priceVnd,
    qty: 1,
    lineTotalVnd: priceVnd,
  };
}

/** `PriceItems` priced at `priceVnd` per line — every product costs the same. */
export function buildCatalogMenuStub(priceVnd: number) {
  return {
    priceItems: vi.fn().mockImplementation((request: { lines: { productId: string }[] }) => {
      const lines = request.lines.map((l) => pricedLine(l.productId, priceVnd));
      const subtotalVnd = lines.reduce((sum, l) => sum + l.lineTotalVnd, 0);
      return Promise.resolve({ lines, subtotalVnd: String(subtotalVnd) });
    }),
  };
}

export function buildCatalogStockStub() {
  return {
    reserveStock: vi.fn().mockResolvedValue({ reservations: [] }),
    releaseStock: vi.fn().mockResolvedValue({ reservations: [] }),
  };
}

/** The ordering module on the test database, catalog stubbed — what both place-order specs run against. */
export async function buildOrdersApp(catalogMenu: unknown, catalogStock: unknown) {
  const configModule = ConfigModule.forRoot({
    isGlobal: true,
    validate: () =>
      envSchema.parse({
        ...testEnv,
        DATABASE_URL: testEnv.DATABASE_URL_TEST,
      }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, OrdersModule],
    providers: [OrdersExpireJob],
  })
    .overrideProvider(CatalogMenuGrpcClient)
    .useValue(catalogMenu)
    .overrideProvider(CatalogStockGrpcClient)
    .useValue(catalogStock)
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

/** The `bl-error-code` and details of an `RpcException` thrown in this process. */
export function readError(exception: unknown): {
  code?: string;
  details?: Record<string, unknown>;
} {
  if (!(exception && typeof exception === 'object' && 'getError' in exception)) return {};
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  const code = metadata.get('bl-error-code')[0] as string | undefined;
  const detailsBin = metadata.get('bl-error-details-bin')[0] as Buffer | undefined;
  const details = detailsBin
    ? (JSON.parse(detailsBin.toString('utf8')) as Record<string, unknown>)
    : undefined;
  return { code, details };
}
