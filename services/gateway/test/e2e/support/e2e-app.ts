import { generateKeyPairSync } from 'node:crypto';
import type { InjectionToken, Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { JWT_AUDIENCE, JWT_ISSUER, newId } from '@brewlite/contracts';
import { RATE_LIMIT_REDIS_CLIENT } from '../../../src/auth/rate-limit-redis.token.js';
import { OrderEventsSource } from '../../../src/events/order-events.source.js';
import { IdentityServiceGrpcClient } from '../../../src/modules/auth/identity-service-grpc.client.js';
import { CatalogAdminGrpcClient } from '../../../src/modules/catalog/catalog-admin-grpc.client.js';
import { CatalogServiceGrpcClient } from '../../../src/modules/catalog/catalog-service-grpc.client.js';
import { CatalogStockGrpcClient } from '../../../src/modules/catalog/catalog-stock-grpc.client.js';
import { LoyaltyGrpcClient } from '../../../src/modules/loyalty/loyalty-grpc.client.js';
import { OrderingServiceGrpcClient } from '../../../src/modules/orders/ordering-service-grpc.client.js';
import { PaymentServiceGrpcClient } from '../../../src/modules/payments/payment-service-grpc.client.js';
import { WebhookServiceGrpcClient } from '../../../src/modules/payments/webhook-service-grpc.client.js';
import { PromotionAdminGrpcClient } from '../../../src/modules/promotions/promotion-admin-grpc.client.js';
import { StaffOrdersGrpcClient } from '../../../src/modules/staff-orders/staff-orders-grpc.client.js';

/** One P-256 key pair per process — the gateway verifies tokens against the public half. */
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const PRIVATE_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const PUBLIC_KEY_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();

/** Every peer client is an empty stub unless a spec supplies its own — nothing here dials a service. */
const PEER_CLIENTS: Type<unknown>[] = [
  CatalogServiceGrpcClient,
  CatalogStockGrpcClient,
  CatalogAdminGrpcClient,
  IdentityServiceGrpcClient,
  OrderingServiceGrpcClient,
  PaymentServiceGrpcClient,
  WebhookServiceGrpcClient,
  PromotionAdminGrpcClient,
  LoyaltyGrpcClient,
  StaffOrdersGrpcClient,
];

/**
 * The two pieces of infrastructure the app would otherwise dial: the rate limiter's Redis
 * client (it fails open without one, but logs an error per request) and the SSE event
 * source's NATS connection. The real ones are exercised in `test/integration`.
 */
const INFRASTRUCTURE_STUBS: ReadonlyArray<readonly [InjectionToken, object]> = [
  [
    RATE_LIMIT_REDIS_CLIENT,
    {
      // Counts every key as 1 — a limit is never hit; counting is proven against real Redis.
      multi: () => ({
        incr: () => ({ pexpire: () => ({ exec: async () => [[null, 1]] }) }),
      }),
      pttl: async () => 0,
      quit: async () => 'OK',
      disconnect: () => undefined,
    },
  ],
  [
    OrderEventsSource,
    {
      frames$: { subscribe: () => ({ unsubscribe: () => undefined }) },
      readinessCheck: () => () => Promise.resolve(true),
    },
  ],
];

export interface E2eApp {
  app: NestExpressApplication;
  /** A signed access token for `role`; a fresh user id unless one is given. */
  tokenFor(role: string, userId?: string): string;
  close(): Promise<void>;
}

export interface E2eOptions {
  /** Listen on an ephemeral port — for specs that open real sockets (SSE). */
  listen?: boolean;
}

/**
 * The gateway's e2e bootstrap, once. `JWT_PUBLIC_KEY` is set **before** `AppModule` is
 * imported: a static import would run the env validation at module load, before any
 * `beforeAll` could set it — so the import is dynamic, here, for every spec.
 */
export async function createE2eApp(
  stubs: ReadonlyArray<readonly [token: InjectionToken, stub: object]> = [],
  { listen = false }: E2eOptions = {},
): Promise<E2eApp> {
  process.env.JWT_PUBLIC_KEY = Buffer.from(PUBLIC_KEY_PEM, 'utf8').toString('base64');
  const { AppModule } = await import('../../../src/app.module.js');
  const { configureApp } = await import('../../../src/configure-app.js');

  const overrides = new Map<InjectionToken, object>([
    ...PEER_CLIENTS.map((token) => [token, {}] as const),
    ...INFRASTRUCTURE_STUBS,
  ]);
  for (const [token, stub] of stubs) overrides.set(token, stub);

  let builder = Test.createTestingModule({ imports: [AppModule] });
  for (const [token, stub] of overrides) builder = builder.overrideProvider(token).useValue(stub);
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  configureApp(app);
  if (listen) await app.listen(0);
  else await app.init();

  return {
    app,
    tokenFor: (role, userId = newId()) =>
      new JwtService().sign(
        { sub: userId, role, sid: newId() },
        {
          algorithm: 'ES256',
          privateKey: PRIVATE_KEY_PEM,
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          expiresIn: 900,
        },
      ),
    close: async () => {
      delete process.env.JWT_PUBLIC_KEY;
      await app.close();
    },
  };
}
