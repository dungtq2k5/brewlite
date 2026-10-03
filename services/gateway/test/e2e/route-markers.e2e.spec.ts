import { generateKeyPairSync } from 'node:crypto';
import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { Auth, RequirePermission } from '@brewlite/nest-common';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';

const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
process.env.JWT_PUBLIC_KEY = Buffer.from(
  publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  'utf8',
).toString('base64');

@Controller('test-only-no-marker')
class NoMarkerController {
  @Get()
  get() {
    return {};
  }
}

@Controller('test-only-two-markers')
class TwoMarkersController {
  @Get()
  @Auth('PUBLIC')
  @RequirePermission('menu.manage')
  get() {
    return {};
  }
}

async function buildWithExtraController(extra: new () => object) {
  const { AppModule } = await import('../../src/app.module.js');
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [extra],
  })
    .overrideProvider(CatalogServiceGrpcClient)
    .useValue({ listCategories: vi.fn(), listProducts: vi.fn(), getProduct: vi.fn() })
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe('gateway e2e — the boot-time marker check', () => {
  it('refuses to start with a controller that has no marker', async () => {
    await expect(buildWithExtraController(NoMarkerController)).rejects.toThrow(/no marker/);
  });

  it('refuses to start with a route carrying two markers', async () => {
    await expect(buildWithExtraController(TwoMarkersController)).rejects.toThrow(
      /both @Auth and @RequirePermission/,
    );
  });
});
