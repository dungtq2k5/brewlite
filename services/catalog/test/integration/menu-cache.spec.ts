import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { MenuCache } from '../../src/modules/menu/menu-cache.service.js';
import { MenuModule } from '../../src/modules/menu/menu.module.js';
import { MenuService } from '../../src/modules/menu/menu.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { prisma, testRedis } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

async function buildModule() {
  const configModule = ConfigModule.forRoot({
    isGlobal: true,
    validate: () =>
      envSchema.parse({
        ...testEnv,
        DATABASE_URL: testEnv.DATABASE_URL_TEST,
        REDIS_URL: testEnv.REDIS_URL_TEST,
      }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, MenuModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

async function seedOneProduct() {
  const category = await prisma.category.create({
    data: { id: newId(), nameEn: 'Coffee', nameVi: 'Cà phê' },
  });
  await prisma.product.create({
    data: {
      id: newId(),
      categoryId: category.id,
      nameEn: 'Iced milk coffee',
      nameVi: 'Cà phê sữa đá',
      basePriceVnd: 29_000,
      sizes: { create: [{ size: 'S', priceDeltaVnd: 0 }] },
    },
  });
}

describe('the menu cache', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;

  beforeAll(async () => {
    app = await buildModule();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a miss queries and sets catalog:menu', async () => {
    await seedOneProduct();
    const menu = app.get(MenuService);

    const res = await menu.listProducts({});

    expect(res.products).toHaveLength(1);
    const raw = await testRedis.get('catalog:menu');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(res);
  });

  it('a hit does not query the database', async () => {
    await seedOneProduct();
    const menu = app.get(MenuService);
    const prismaService = app.get(PrismaService);

    await menu.listProducts({});
    const spy = vi.spyOn(prismaService.product, 'findMany');
    await menu.listProducts({});

    expect(spy).not.toHaveBeenCalled();
  });

  it('invalidate() removes the cached menu', async () => {
    await seedOneProduct();
    const menu = app.get(MenuService);
    const cache = app.get(MenuCache);

    await menu.listProducts({});
    await cache.invalidate();

    expect(await testRedis.get('catalog:menu')).toBeNull();
  });

  it('with the client pointed at a closed port, the menu is still served', async () => {
    const downRedis = new Redis({
      port: 25999,
      host: '127.0.0.1',
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 200,
      lazyConnect: true,
    });
    const cache = new MenuCache(downRedis);
    await seedOneProduct();

    const res = await cache.getOrLoad(() => app.get(MenuService).listProducts({}));

    expect(res.products).toHaveLength(1);
    await downRedis.quit().catch(() => undefined);
  });
});
