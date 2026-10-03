import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createE2eApp, type E2eApp } from './support/e2e-app.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';
import { IdentityServiceGrpcClient } from '../../src/modules/auth/identity-service-grpc.client.js';

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

describe('gateway e2e — /users/me routes', () => {
  let app: NestExpressApplication;
  let e2e: E2eApp;
  const tokenFor = (userId: string, role = 'CUSTOMER') => e2e.tokenFor(role, userId);

  beforeAll(async () => {
    e2e = await createE2eApp([
      [
        CatalogServiceGrpcClient,
        { listCategories: vi.fn(), listProducts: vi.fn(), getProduct: vi.fn() },
      ],
      [IdentityServiceGrpcClient, identityClientStub],
    ]);
    app = e2e.app;
  });

  afterEach(() => {
    identityClientStub.getMe.mockReset();
    identityClientStub.updateMe.mockReset();
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('GET /users/me — 200 Me, Cache-Control private no-store', async () => {
    const userId = newId();
    identityClientStub.getMe.mockResolvedValue({ me: meProto({ id: userId }) });
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${tokenFor(userId)}`);
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
      .set('Authorization', `Bearer ${tokenFor(userId)}`)
      .send({ fullName: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe('New Name');
  });

  it("a staff caller's permissions come from ROLE_PERMISSIONS[role]", async () => {
    const userId = newId();
    identityClientStub.getMe.mockResolvedValue({ me: meProto({ id: userId, role: 'STAFF' }) });
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${tokenFor(userId, 'STAFF')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.permissions).toEqual([
      'stock.update',
      'order.board.read',
      'order.status.update',
      'order.cancel.paid',
    ]);
  });
});
