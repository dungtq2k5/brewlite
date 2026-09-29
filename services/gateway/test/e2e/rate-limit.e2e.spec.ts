import { Controller, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Auth, RateLimit, SkipEnvelope } from '@brewlite/nest-common';
import { AppModule } from '../../src/app.module.js';
import { RATE_LIMIT_REDIS_CLIENT } from '../../src/auth/rate-limit-redis.token.js';
import { configureApp } from '../../src/configure-app.js';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';
import { testEnv } from '../setup/env.js';

@Controller('test-only-auth-rate')
@Auth('PUBLIC')
@RateLimit('AUTH')
class TestOnlyAuthRateController {
  @Post()
  @SkipEnvelope()
  post() {
    return { ok: true };
  }
}

async function buildApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [TestOnlyAuthRateController],
  })
    .overrideProvider(CatalogServiceGrpcClient)
    .useValue({ listCategories: vi.fn(), listProducts: vi.fn(), getProduct: vi.fn() })
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  configureApp(app);
  await app.init();
  return app;
}

describe('gateway e2e — RateLimitGuard', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await buildApp();
    // The guard fails open if a command lands before the client finishes connecting
    // (correct in production too) — wait for it here so the test measures the counting.
    const redisClient = app.get<Redis>(RATE_LIMIT_REDIS_CLIENT);
    if (redisClient.status !== 'ready') {
      await new Promise((resolve) => redisClient.once('ready', resolve));
    }
    // A clean slate, not the TTL — the gateway's dedicated test database (14) is never
    // shared with another spec run, but flushing keeps a re-run from starting saturated.
    await redisClient.flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  it('the AUTH class tracks its ip and email buckets as two separate keys', async () => {
    const redis = new Redis(testEnv.REDIS_URL_TEST);
    const email = `two-buckets-${Date.now()}@brewlite.test`;
    await request(app.getHttpServer()).post('/api/v1/test-only-auth-rate').send({ email });

    const emailKey = await redis.get(`gw:rl:AUTH:email:${email}`);
    const ipKeys = await redis.keys('gw:rl:AUTH:ip:*');
    expect(emailKey).not.toBeNull();
    expect(ipKeys.length).toBeGreaterThan(0);

    await redis.quit();
  });

  it('the 11th request for one email is 429 RATE_LIMITED with Retry-After', async () => {
    const email = `rate-limit-${Date.now()}@brewlite.test`;
    let last: request.Response | undefined;
    for (let i = 0; i < 11; i += 1) {
      last = await request(app.getHttpServer()).post('/api/v1/test-only-auth-rate').send({ email });
    }
    expect(last?.status).toBe(429);
    expect(last?.body.error.code).toBe('RATE_LIMITED');
    expect(last?.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(last?.headers['retry-after']).toBeTruthy();
  });
});
