import { Controller, Get, Query } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createZodDto } from '@brewlite/nest-common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';

class TestQueryDto extends createZodDto(z.object({ name: z.string().min(3) })) {}

@Controller('test-only')
class TestOnlyController {
  @Get()
  get(@Query() query: TestQueryDto) {
    return query;
  }
}

const grpcClientStub = { listCategories: vi.fn() };

async function buildApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [TestOnlyController],
  })
    .overrideProvider(CatalogServiceGrpcClient)
    .useValue(grpcClientStub)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  configureApp(app);
  await app.init();
  return app;
}

function serviceError(code: number, blCode?: string) {
  return Object.assign(new Error('grpc failure'), {
    code,
    metadata: { get: (key: string) => (key === 'bl-error-code' && blCode ? [blCode] : []) },
  });
}

describe('gateway e2e — GET /categories', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    grpcClientStub.listCategories.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('envelopes a successful call as { data }', async () => {
    grpcClientStub.listCategories.mockResolvedValue({
      categories: [
        { id: '01a0d799-fda1-7c3e-8da5-3b5de192d879', name: { en: 'Coffee', vi: 'Cà phê' } },
      ],
    });
    const res = await request(app.getHttpServer()).get('/api/v1/categories');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [{ id: '01a0d799-fda1-7c3e-8da5-3b5de192d879', name: { en: 'Coffee', vi: 'Cà phê' } }],
    });
  });

  it('echoes a valid X-Request-Id', async () => {
    grpcClientStub.listCategories.mockResolvedValue({ categories: [] });
    const res = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .set('X-Request-Id', 'e2e-check');
    expect(res.headers['x-request-id']).toBe('e2e-check');
  });

  it('generates a request id when none is sent', async () => {
    grpcClientStub.listCategories.mockResolvedValue({ categories: [] });
    const res = await request(app.getHttpServer()).get('/api/v1/categories');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers 404 ROUTE_NOT_FOUND for an unknown route', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('answers 400 MALFORMED_REQUEST for unparseable JSON', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('content-type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MALFORMED_REQUEST');
  });

  it('answers 400 VALIDATION_FAILED with issues for a bad query', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/test-only').query({ name: 'ab' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.issues.length).toBeGreaterThan(0);
  });

  it('maps an UNAVAILABLE peer to 503', async () => {
    grpcClientStub.listCategories.mockRejectedValue(serviceError(14));
    const res = await request(app.getHttpServer()).get('/api/v1/categories');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('maps a DEADLINE_EXCEEDED peer to 504', async () => {
    grpcClientStub.listCategories.mockRejectedValue(serviceError(4));
    const res = await request(app.getHttpServer()).get('/api/v1/categories');
    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe('UPSTREAM_TIMEOUT');
  });

  it('maps an unknown bl-error-code to 500', async () => {
    grpcClientStub.listCategories.mockRejectedValue(serviceError(2, 'NOT_A_REAL_CODE'));
    const res = await request(app.getHttpServer()).get('/api/v1/categories');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
  });

  it('serves /health/ready unprefixed', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready');
    expect(res.status).toBe(200);
  });

  it('answers 404 for the prefixed health path', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(404);
  });
});
