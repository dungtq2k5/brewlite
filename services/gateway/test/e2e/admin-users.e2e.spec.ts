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

function serviceError(code: number, blCode: string, details?: unknown) {
  return Object.assign(new Error('grpc failure'), {
    code,
    metadata: {
      get: (key: string) => {
        if (key === 'bl-error-code') return [blCode];
        if (key === 'bl-error-details-bin' && details !== undefined) {
          return [Buffer.from(JSON.stringify(details), 'utf8')];
        }
        return [];
      },
    },
  });
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
  it('GET /admin/users/:id — 200 with the AdminUser and its permissions, 404 when the peer has none', async () => {
    const user = adminUserProto({ role: 'STAFF', lastLoginAt: new Date().toISOString() });
    identityClientStub.getUser.mockResolvedValueOnce({ user });
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${user.id}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: user.id,
      role: 'STAFF',
      lockedUntil: null,
      deletedAt: null,
    });
    expect(res.body.data.permissions.length).toBeGreaterThan(0);
    expect(identityClientStub.getUser).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'USER', role: 'ADMIN' }),
      { id: user.id },
      expect.any(String),
    );

    identityClientStub.getUser.mockRejectedValueOnce(
      serviceError(5, 'RESOURCE_NOT_FOUND', { resource: 'USER' }),
    );
    const missing = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${newId()}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      details: { resource: 'USER' },
    });
  });

  it('POST /admin/users/:id/lock — 200 with the lock, passing reason and lockedUntil through', async () => {
    const id = newId();
    const lockedUntil = new Date(Date.now() + 86_400_000).toISOString();
    identityClientStub.lockUser.mockResolvedValueOnce({
      user: adminUserProto({ id, isLocked: true, lockedUntil, lockReason: 'spam' }),
    });
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${id}/lock`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ reason: 'spam', lockedUntil });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ isLocked: true, lockedUntil, lockReason: 'spam' });
    expect(identityClientStub.lockUser).toHaveBeenCalledWith(
      expect.anything(),
      { id, reason: 'spam', lockedUntil },
      expect.any(String),
    );
  });

  it('POST /admin/users/:id/lock on ONESELF — 403 SELF_ACTION_FORBIDDEN from the peer', async () => {
    identityClientStub.lockUser.mockRejectedValueOnce(serviceError(7, 'SELF_ACTION_FORBIDDEN'));
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${newId()}/lock`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ reason: 'oops' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SELF_ACTION_FORBIDDEN');
  });

  it('POST /admin/users/:id/lock with no reason — 400, without reaching the peer', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${newId()}/lock`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(identityClientStub.lockUser).not.toHaveBeenCalled();
  });

  it('POST /admin/users/:id/unlock and /restore — 200 with the AdminUser', async () => {
    const id = newId();
    identityClientStub.unlockUser.mockResolvedValueOnce({ user: adminUserProto({ id }) });
    const unlocked = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${id}/unlock`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.data).toMatchObject({ id, isLocked: false });

    identityClientStub.restoreUser.mockResolvedValueOnce({ user: adminUserProto({ id }) });
    const restored = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${id}/restore`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(restored.status).toBe(200);
    expect(restored.body.data).toMatchObject({ id, deletedAt: null });
    expect(identityClientStub.restoreUser).toHaveBeenCalledWith(
      expect.anything(),
      { id },
      expect.any(String),
    );
  });
});
