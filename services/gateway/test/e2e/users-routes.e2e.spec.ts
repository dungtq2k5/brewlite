import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createE2eApp, type E2eApp } from './support/e2e-app.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { RATE_LIMIT_KEY } from '@brewlite/nest-common';
import { UsersController } from '../../src/modules/users/users.controller.js';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';
import { IdentityServiceGrpcClient } from '../../src/modules/auth/identity-service-grpc.client.js';

const identityClientStub = { getMe: vi.fn(), updateMe: vi.fn(), changePassword: vi.fn() };

function serviceError(code: number, blCode: string) {
  return Object.assign(new Error('grpc failure'), {
    code,
    metadata: { get: (key: string) => (key === 'bl-error-code' ? [blCode] : []) },
  });
}

const sidOf = (token: string): string =>
  (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8')) as { sid: string })
    .sid;

function meProto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: newId(),
    email: 'customer@brewlite.test',
    fullName: 'A Customer',
    role: 'CUSTOMER',
    hasPassword: true,
    signsInWithGoogle: false,
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
    identityClientStub.changePassword.mockReset();
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

  it('GET /users/me — signsInWithGoogle is passed through beside hasPassword', async () => {
    const userId = newId();
    identityClientStub.getMe.mockResolvedValue({
      me: meProto({ id: userId, hasPassword: true, signsInWithGoogle: true }),
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${tokenFor(userId)}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ hasPassword: true, signsInWithGoogle: true });
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

  describe('PATCH /users/me/password', () => {
    let ip = 0;
    const patch = (token: string | undefined, body: unknown) => {
      ip += 1;
      const req = request(app.getHttpServer())
        .patch('/api/v1/users/me/password')
        .set('X-Forwarded-For', `10.66.${(ip >> 8) & 255}.${ip & 255}`);
      return (token ? req.set('Authorization', `Bearer ${token}`) : req).send(body as object);
    };

    it('204, with the token’s session kept: the sid goes to identity beside the caller', async () => {
      identityClientStub.changePassword.mockResolvedValue({});
      const userId = newId();
      const token = tokenFor(userId);
      const res = await patch(token, {
        currentPassword: 'old-password',
        newPassword: 'new-password',
      });
      expect(res.status).toBe(204);
      expect(res.headers['cache-control']).toBe('private, no-store');
      const [caller, sent] = identityClientStub.changePassword.mock.calls[0]!;
      expect(caller).toMatchObject({ kind: 'USER', userId });
      expect(sent).toEqual({
        sessionId: sidOf(token),
        currentPassword: 'old-password',
        newPassword: 'new-password',
      });
    });

    it('403 CURRENT_PASSWORD_INCORRECT from identity', async () => {
      identityClientStub.changePassword.mockRejectedValue(
        serviceError(7, 'CURRENT_PASSWORD_INCORRECT'),
      );
      const res = await patch(tokenFor(newId()), {
        currentPassword: 'wrong-password',
        newPassword: 'new-password',
      });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CURRENT_PASSWORD_INCORRECT');
    });

    it('400 VALIDATION_FAILED for 7 bytes, for over 72 bytes, and for an unknown field', async () => {
      const token = tokenFor(newId());
      for (const body of [
        { newPassword: '7 bytes' },
        { newPassword: 'Mỗi sáng tôi uống một ly cà phê sữa đá thật đậm ở góc phố cũ Hà Nội' },
        { newPassword: 'new-password', email: 'x@brewlite.test' },
      ]) {
        const res = await patch(token, body);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
      }
      expect(identityClientStub.changePassword).not.toHaveBeenCalled();
    });

    it('401 without a token — USER only', async () => {
      const res = await patch(undefined, { newPassword: 'new-password' });
      expect(res.status).toBe(401);
    });

    it('is in the AUTH rate-limit class (counting itself is proven against real Redis)', () => {
      const cls = Reflect.getMetadata(RATE_LIMIT_KEY, UsersController.prototype.changePassword);
      expect(cls).toBe('AUTH');
    });
  });
});
