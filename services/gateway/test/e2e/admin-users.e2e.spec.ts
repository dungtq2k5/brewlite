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

const identityClientStub = {
  listUsers: vi.fn(),
  getUser: vi.fn(),
  changeRole: vi.fn(),
  lockUser: vi.fn(),
  unlockUser: vi.fn(),
  deactivateUser: vi.fn(),
  restoreUser: vi.fn(),
};

function adminUserProto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: newId(),
    email: 'target@brewlite.test',
    fullName: 'Target User',
    role: 'CUSTOMER',
    hasPassword: true,
    preferredLocale: 'en',
    createdAt: new Date().toISOString(),
    isLocked: false,
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

function signAccessToken(role: string) {
  const jwt = new JwtService();
  return jwt.sign(
    { sub: newId(), role, sid: newId() },
    {
      algorithm: 'ES256',
      privateKey: privateKeyPem,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: 900,
    },
  );
}

describe('gateway e2e — /admin/users routes', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    identityClientStub.listUsers.mockReset();
    identityClientStub.getUser.mockReset();
    identityClientStub.changeRole.mockReset();
    identityClientStub.lockUser.mockReset();
    identityClientStub.unlockUser.mockReset();
    identityClientStub.deactivateUser.mockReset();
    identityClientStub.restoreUser.mockReset();
  });

  afterAll(async () => {
    delete process.env.JWT_PUBLIC_KEY;
    await app.close();
  });

  it('perm:user.manage refuses a CUSTOMER with 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${signAccessToken('CUSTOMER')}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('perm:user.manage refuses a STAFF with 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${signAccessToken('STAFF')}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('GET /admin/users — 200 with the list and its meta', async () => {
    identityClientStub.listUsers.mockResolvedValue({
      users: [adminUserProto(), adminUserProto()],
      meta: { page: 1, pageSize: 20, total: 2 },
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${signAccessToken('ADMIN')}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 2 });
  });

  it('?sort=password is refused with 400 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users?sort=password')
      .set('Authorization', `Bearer ${signAccessToken('ADMIN')}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('?locked=false is coerced to the literal boolean false, not truthiness', async () => {
    identityClientStub.listUsers.mockResolvedValue({
      users: [],
      meta: { page: 1, pageSize: 20, total: 0 },
    });
    await request(app.getHttpServer())
      .get('/api/v1/admin/users?locked=false')
      .set('Authorization', `Bearer ${signAccessToken('ADMIN')}`);
    expect(identityClientStub.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'USER' }),
      expect.objectContaining({ locked: false }),
      expect.anything(),
    );
  });

  it('PATCH /admin/users/:id/role — 200 with the updated AdminUser', async () => {
    identityClientStub.changeRole.mockResolvedValue({ user: adminUserProto({ role: 'STAFF' }) });
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${newId()}/role`)
      .set('Authorization', `Bearer ${signAccessToken('ADMIN')}`)
      .send({ role: 'STAFF' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('STAFF');
  });

  it('DELETE /admin/users/:id — 204 with no body', async () => {
    identityClientStub.deactivateUser.mockResolvedValue({ user: adminUserProto() });
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/users/${newId()}`)
      .set('Authorization', `Bearer ${signAccessToken('ADMIN')}`);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });
});
