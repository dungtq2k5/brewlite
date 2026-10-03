import { generateKeyPairSync } from 'node:crypto';
import { Controller, Get } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { JWT_AUDIENCE, JWT_ISSUER, newId } from '@brewlite/contracts';
import { RequirePermission } from '@brewlite/nest-common';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';

@Controller('test-only-perm')
@RequirePermission('menu.manage')
class TestOnlyPermController {
  @Get()
  get() {
    return { ok: true };
  }
}

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

/**
 * A separate file (not a second describe block in auth-guard.e2e.spec.ts): this mutates
 * `NODE_ENV` before importing `AppModule`, and a second `Test.createTestingModule`
 * compile of the same `AppModule` class within one process does not reliably re-read it.
 */
describe('gateway e2e — PERMISSION_DENIED drops details in production', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_PUBLIC_KEY = Buffer.from(publicKeyPem, 'utf8').toString('base64');

    const { AppModule } = await import('../../src/app.module.js');
    const { configureApp } = await import('../../src/configure-app.js');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestOnlyPermController],
    })
      .overrideProvider(CatalogServiceGrpcClient)
      .useValue({ listCategories: vi.fn(), listProducts: vi.fn(), getProduct: vi.fn() })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    delete process.env.NODE_ENV;
    delete process.env.JWT_PUBLIC_KEY;
    await app.close();
  });

  it('403 PERMISSION_DENIED has no details in production', async () => {
    const jwt = new JwtService();
    const token = jwt.sign(
      { sub: newId(), role: 'CUSTOMER', sid: newId() },
      {
        algorithm: 'ES256',
        privateKey: privateKeyPem,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: 900,
      },
    );
    const res = await request(app.getHttpServer())
      .get('/api/v1/test-only-perm')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.details).toBeUndefined();
  });
});
