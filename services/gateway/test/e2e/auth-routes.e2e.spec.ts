import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { AppModule } from '../../src/app.module.js';
import { RATE_LIMIT_REDIS_CLIENT } from '../../src/auth/rate-limit-redis.token.js';
import { configureApp } from '../../src/configure-app.js';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';
import { IdentityServiceGrpcClient } from '../../src/modules/auth/identity-service-grpc.client.js';

const identityClientStub = {
  register: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
};

function meProto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: newId(),
    email: 'customer@brewlite.test',
    fullName: 'A Customer',
    role: 'CUSTOMER',
    hasPassword: true,
    preferredLocale: 'en',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function sessionProto() {
  return {
    user: meProto(),
    accessToken: 'a.b.c',
    accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    refreshToken: 'refresh-token-value',
    refreshTokenExpiresAt: new Date(Date.now() + 2_592_000_000).toISOString(),
  };
}

function serviceError(code: number, blCode?: string, details?: unknown) {
  return Object.assign(new Error('grpc failure'), {
    code,
    metadata: {
      get: (key: string) => {
        if (key === 'bl-error-code') return blCode ? [blCode] : [];
        if (key === 'bl-error-details-bin' && details !== undefined) {
          return [Buffer.from(JSON.stringify(details), 'utf8')];
        }
        return [];
      },
    },
  });
}

async function buildApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CatalogServiceGrpcClient)
    .useValue({ listCategories: vi.fn(), listProducts: vi.fn(), getProduct: vi.fn() })
    .overrideProvider(IdentityServiceGrpcClient)
    .useValue(identityClientStub)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  configureApp(app);
  await app.init();
  return app;
}

describe('gateway e2e — /auth routes', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await buildApp();
    // The guard fails open if a command lands before the client finishes connecting
    // (correct in production too) — wait for it here so the test measures the counting.
    const redisClient = app.get<Redis>(RATE_LIMIT_REDIS_CLIENT);
    if (redisClient.status !== 'ready') {
      await new Promise((resolve) => redisClient.once('ready', resolve));
    }
    // A clean slate, not the TTL — a prior run's buckets on this dev Redis would
    // otherwise leave the shared AUTH-class `ip` key already saturated.
    const keys = await redisClient.keys('gw:rl:AUTH:*');
    if (keys.length > 0) await redisClient.del(...keys);
  });

  afterEach(() => {
    identityClientStub.register.mockReset();
    identityClientStub.login.mockReset();
    identityClientStub.refresh.mockReset();
    identityClientStub.logout.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register — 201 Session, Cache-Control private no-store', async () => {
    identityClientStub.register.mockResolvedValue(sessionProto());
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'new@brewlite.test', password: 'password123', fullName: 'New Customer' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('CUSTOMER');
    expect(res.body.data.user.permissions).toEqual([]);
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('POST /auth/register — 409 EMAIL_TAKEN', async () => {
    identityClientStub.register.mockRejectedValue(serviceError(6, 'EMAIL_TAKEN'));
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'taken@brewlite.test', password: 'password123', fullName: 'X' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('POST /auth/register — 400 VALIDATION_FAILED for a 7-byte password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'short@brewlite.test', password: '1234567', fullName: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('POST /auth/login — 200 Session', async () => {
    identityClientStub.login.mockResolvedValue(sessionProto());
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'customer@brewlite.test', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('POST /auth/login — 401 INVALID_CREDENTIALS', async () => {
    identityClientStub.login.mockRejectedValue(serviceError(16, 'INVALID_CREDENTIALS'));
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'wrong@brewlite.test', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /auth/login — 403 ACCOUNT_LOCKED with lockedUntil, no reason', async () => {
    const lockedUntil = new Date(Date.now() + 3_600_000).toISOString();
    identityClientStub.login.mockRejectedValue(serviceError(9, 'ACCOUNT_LOCKED', { lockedUntil }));
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'locked@brewlite.test', password: 'password123' });
    expect(res.status).toBe(403);
    expect(res.body.error.details).toEqual({ lockedUntil });
  });

  it('POST /auth/refresh — 200 { accessToken, accessTokenExpiresAt }', async () => {
    identityClientStub.refresh.mockResolvedValue({
      accessToken: 'new.access.token',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    });
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'some-refresh-token' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('new.access.token');
  });

  it('POST /auth/refresh — 401 UNAUTHENTICATED for an unknown token', async () => {
    identityClientStub.refresh.mockRejectedValue(serviceError(16, 'UNAUTHENTICATED'));
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'unknown' });
    expect(res.status).toBe(401);
  });

  it('POST /auth/logout — 204', async () => {
    identityClientStub.logout.mockResolvedValue({});
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'some-refresh-token' });
    expect(res.status).toBe(204);
  });

  it('the menu stays public — a junk Bearer token does not block GET /categories', async () => {
    const catalogClient = app.get(CatalogServiceGrpcClient) as unknown as {
      listCategories: ReturnType<typeof vi.fn>;
    };
    catalogClient.listCategories.mockResolvedValue({ categories: [] });
    const res = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .set('Authorization', 'Bearer junk');
    expect(res.status).toBe(200);
  });
});
