import { generateKeyPairSync } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { JWT_AUDIENCE, JWT_ISSUER, newId } from '@brewlite/contracts';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';
import { IdentityServiceGrpcClient } from '../../src/modules/auth/identity-service-grpc.client.js';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const identityClientStub = { getMe: vi.fn(), updateMe: vi.fn() };

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

async function buildApp() {
  process.env.JWT_PUBLIC_KEY = Buffer.from(publicKeyPem, 'utf8').toString('base64');
  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp } = await import('../../src/configure-app.js');
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

function signAccessToken(userId: string, role = 'CUSTOMER') {
  const jwt = new JwtService();
  return jwt.sign(
    { sub: userId, role, sid: newId() },
    {
      algorithm: 'ES256',
      privateKey: privateKeyPem,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: 900,
    },
  );
}

describe('gateway e2e — /users/me routes', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    identityClientStub.getMe.mockReset();
    identityClientStub.updateMe.mockReset();
  });

  afterAll(async () => {
    delete process.env.JWT_PUBLIC_KEY;
    await app.close();
  });

  it('GET /users/me — 200 Me, Cache-Control private no-store', async () => {
    const userId = newId();
    identityClientStub.getMe.mockResolvedValue({ me: meProto({ id: userId }) });
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${signAccessToken(userId)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(userId);
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('GET /users/me — 401 UNAUTHENTICATED without a token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/users/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('PATCH /users/me — 200 Me with the updated full name', async () => {
    const userId = newId();
    identityClientStub.updateMe.mockResolvedValue({
      me: meProto({ id: userId, fullName: 'New Name' }),
    });
    const res = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${signAccessToken(userId)}`)
      .send({ fullName: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe('New Name');
  });

  it("a staff caller's permissions come from ROLE_PERMISSIONS[role]", async () => {
    const userId = newId();
    identityClientStub.getMe.mockResolvedValue({ me: meProto({ id: userId, role: 'STAFF' }) });
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${signAccessToken(userId, 'STAFF')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.permissions).toEqual([
      'stock.update',
      'order.board.read',
      'order.status.update',
      'order.cancel.paid',
    ]);
  });
});
