import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';

/**
 * A separate file: `REDIS_URL` must point at a closed port before `AppModule` (and its
 * `RATE_LIMIT_REDIS_CLIENT` factory) is imported, so this proves fail-open with a real,
 * never-connecting client — not a mock.
 */
describe('gateway e2e — RateLimitGuard fails open when Redis is down', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:25998/0';
    const { AppModule } = await import('../../src/app.module.js');
    const { configureApp } = await import('../../src/configure-app.js');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CatalogServiceGrpcClient)
      .useValue({ listCategories: vi.fn().mockResolvedValue({ categories: [] }) })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    delete process.env.REDIS_URL;
    await app.close();
  });

  it('still answers 200 with Redis unreachable, logging one error', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/categories');
    expect(res.status).toBe(200);
  });
});
