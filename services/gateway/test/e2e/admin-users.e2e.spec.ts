import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createE2eApp, type E2eApp } from './support/e2e-app.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';
import { IdentityServiceGrpcClient } from '../../src/modules/auth/identity-service-grpc.client.js';

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

describe('gateway e2e — /admin/users routes', () => {
  let app: NestExpressApplication;
  let e2e: E2eApp;

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
    identityClientStub.listUsers.mockReset();
    identityClientStub.getUser.mockReset();
    identityClientStub.changeRole.mockReset();
    identityClientStub.lockUser.mockReset();
    identityClientStub.unlockUser.mockReset();
    identityClientStub.deactivateUser.mockReset();
    identityClientStub.restoreUser.mockReset();
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('perm:user.manage refuses a CUSTOMER with 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('perm:user.manage refuses a STAFF with 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${e2e.tokenFor('STAFF')}`);
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
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 2 });
  });

  it('?sort=password is refused with 400 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users?sort=password')
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
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
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
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
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ role: 'STAFF' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('STAFF');
  });

  it('DELETE /admin/users/:id — 204 with no body', async () => {
    identityClientStub.deactivateUser.mockResolvedValue({ user: adminUserProto() });
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/users/${newId()}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });
});
