import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The one unstubbed case: a real `CatalogServiceGrpcClient` against a closed port must
 * answer 503 within the 2 s deadline, never 504 — the channel never reached `READY`
 * (architecture §2.2).
 */
describe('gateway e2e — catalog peer unreachable', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env.CATALOG_GRPC_URL = 'localhost:25053';
    const { AppModule } = await import('../../src/app.module.js');
    const { configureApp } = await import('../../src/configure-app.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 503 UPSTREAM_UNAVAILABLE, not 504, within the deadline', async () => {
    const start = Date.now();
    const res = await request(app.getHttpServer()).get('/api/v1/categories');
    expect(Date.now() - start).toBeLessThan(2000);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
  });
});
