import { generateKeyPairSync } from 'node:crypto';
import { Controller, Get } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { JWT_AUDIENCE, JWT_ISSUER, newId } from '@brewlite/contracts';
import { Auth, RequirePermission } from '@brewlite/nest-common';
import { Ctx, type UserContext } from '../../src/auth/request-context.js';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const jwt = new JwtService();

function signAccessToken(
  overrides: {
    sub?: string;
    role?: string;
    sid?: string;
    issuer?: string;
    audience?: string;
    expiresIn?: number;
    privateKeyPem?: string;
  } = {},
) {
  return jwt.sign(
    {
      sub: overrides.sub ?? newId(),
      role: overrides.role ?? 'CUSTOMER',
      sid: overrides.sid ?? newId(),
    },
    {
      algorithm: 'ES256',
      privateKey: overrides.privateKeyPem ?? privateKeyPem,
      issuer: overrides.issuer ?? JWT_ISSUER,
      audience: overrides.audience ?? JWT_AUDIENCE,
      expiresIn: overrides.expiresIn ?? 900,
    },
  );
}

@Controller('test-only-user')
@Auth('USER')
class TestOnlyUserController {
  @Get()
  get(@Ctx() ctx: UserContext) {
    return { userId: ctx.userId, role: ctx.role };
  }
}

@Controller('test-only-perm')
@RequirePermission('menu.manage')
class TestOnlyPermController {
  @Get()
  get() {
    return { ok: true };
  }
}

const grpcClientStub = { listCategories: vi.fn(), listProducts: vi.fn(), getProduct: vi.fn() };

async function buildApp() {
  process.env.JWT_PUBLIC_KEY = Buffer.from(publicKeyPem, 'utf8').toString('base64');
  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp } = await import('../../src/configure-app.js');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [TestOnlyUserController, TestOnlyPermController],
  })
    .overrideProvider(CatalogServiceGrpcClient)
    .useValue(grpcClientStub)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  configureApp(app);
  await app.init();
  return app;
}

describe('gateway e2e — AuthGuard, PermissionGuard', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    delete process.env.JWT_PUBLIC_KEY;
    await app.close();
  });

  it('PUBLIC ignores a junk Authorization header', async () => {
    grpcClientStub.listCategories.mockResolvedValue({ categories: [] });
    const res = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(200);
  });

  it('USER refuses a missing token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/test-only-user');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('USER refuses an expired token', async () => {
    const token = signAccessToken({ expiresIn: -1 });
    const res = await request(app.getHttpServer())
      .get('/api/v1/test-only-user')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('USER refuses a token signed with a different key', async () => {
    const wrongKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
    const token = signAccessToken({
      privateKeyPem: wrongKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/test-only-user')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('USER refuses the wrong audience', async () => {
    const token = signAccessToken({ audience: 'someone-else' });
    const res = await request(app.getHttpServer())
      .get('/api/v1/test-only-user')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('USER accepts a valid token and exposes the context', async () => {
    const userId = newId();
    const token = signAccessToken({ sub: userId, role: 'STAFF' });
    const res = await request(app.getHttpServer())
      .get('/api/v1/test-only-user')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ userId, role: 'STAFF' });
  });

  it('perm: refuses a role without the permission — 403 with the required code', async () => {
    const token = signAccessToken({ role: 'CUSTOMER' });
    const res = await request(app.getHttpServer())
      .get('/api/v1/test-only-perm')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
    expect(res.body.error.details).toEqual({ required: ['menu.manage'] });
  });

  it('perm: allows a role with the permission', async () => {
    const token = signAccessToken({ role: 'ADMIN' });
    const res = await request(app.getHttpServer())
      .get('/api/v1/test-only-perm')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
