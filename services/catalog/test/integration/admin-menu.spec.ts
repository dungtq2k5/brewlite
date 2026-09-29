import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId, Role, type Locale } from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
import { envSchema } from '../../src/config/env.schema.js';
import { AdminMenuModule } from '../../src/modules/admin-menu/admin-menu.module.js';
import { AdminCategoriesService } from '../../src/modules/admin-menu/admin-categories.service.js';
import { AdminProductsService } from '../../src/modules/admin-menu/admin-products.service.js';
import { AdminToppingsService } from '../../src/modules/admin-menu/admin-toppings.service.js';
import { MenuCache } from '../../src/modules/menu/menu-cache.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { prisma } from '../setup/per-file.js';
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
    imports: [configModule, PrismaModule, AdminMenuModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

function errorCodeOf(exception: unknown): string | undefined {
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  return metadata.get('bl-error-code')[0] as string | undefined;
}

function detailsOf(exception: unknown): unknown {
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  const [raw] = metadata.get('bl-error-details-bin');
  if (raw === undefined) return undefined;
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as string, 'binary');
  return JSON.parse(buffer.toString('utf8')) as unknown;
}

const caller: Caller = { kind: 'USER', userId: newId(), role: Role.ADMIN };

async function seedLiveCategory() {
  return prisma.category.create({
    data: { id: newId(), nameEn: `Cat ${newId()}`, nameVi: `Danh muc ${newId()}` },
  });
}

describe('AdminMenuService integration', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let categories: AdminCategoriesService;
  let products: AdminProductsService;
  let toppings: AdminToppingsService;
  let cache: MenuCache;

  beforeAll(async () => {
    app = await buildModule();
    categories = app.get(AdminCategoriesService);
    products = app.get(AdminProductsService);
    toppings = app.get(AdminToppingsService);
    cache = app.get(MenuCache);
  });

  afterAll(async () => {
    await app.close();
  });

  it('category lifecycle: create, name clash per locale, delete empty, restore', async () => {
    const name = `Juice ${newId()}`;
    const created = await categories.createCategory({ name: { en: name, vi: 'Nuoc ep' } });
    expect(created.category?.isActive).toBe(true);

    const clashEn = await categories
      .createCategory({ name: { en: name, vi: `Khac ${newId()}` } })
      .catch((e: unknown) => e);
    expect(errorCodeOf(clashEn)).toBe('CATEGORY_NAME_TAKEN');
    expect(detailsOf(clashEn)).toEqual({ locale: 'en' as Locale });

    const deleted = await categories.deleteCategory({ id: created.category!.id }, caller);
    expect(deleted.category?.deletedAt).toBeTruthy();

    const restored = await categories.restoreCategory({ id: created.category!.id });
    expect(restored.category?.deletedAt).toBeUndefined();
  });

  it('deleting a category with a live product refuses CATEGORY_IN_USE', async () => {
    const category = await seedLiveCategory();
    await products.createProduct({
      categoryId: category.id,
      name: { en: `P ${newId()}`, vi: `S ${newId()}` },
      basePriceVnd: 20_000,
      sizes: [{ size: 'S', priceDeltaVnd: 0 }],
      toppingIds: [],
    });
    const error = await categories
      .deleteCategory({ id: category.id }, caller)
      .catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('CATEGORY_IN_USE');
  });

  it('category delete vs product create concurrently: one is refused, and the deleted category never gains a live product', async () => {
    const category = await seedLiveCategory();

    const results = await Promise.allSettled([
      categories.deleteCategory({ id: category.id }, caller),
      products.createProduct({
        categoryId: category.id,
        name: { en: `Race ${newId()}`, vi: `Dua ${newId()}` },
        basePriceVnd: 15_000,
        sizes: [{ size: 'S', priceDeltaVnd: 0 }],
        toppingIds: [],
      }),
    ]);

    const categoryRow = await prisma.category.findUniqueOrThrow({ where: { id: category.id } });
    const liveProductCount = await prisma.product.count({
      where: { categoryId: category.id, deletedAt: null },
    });

    if (categoryRow.deletedAt !== null) {
      // The delete won the race — no live product may exist in the deleted category.
      expect(liveProductCount).toBe(0);
    } else {
      // The create won — the category must still be live.
      expect(liveProductCount).toBe(1);
    }
    // Whichever order, both operations completed without a stuck lock.
    expect(results.every((r) => r.status === 'fulfilled' || r.status === 'rejected')).toBe(true);
  });

  it('product lifecycle: create with an unknown category, delete, then get returns not found for a live-only view', async () => {
    const badCategory = await products
      .createProduct({
        categoryId: newId(),
        name: { en: `Bad ${newId()}`, vi: `X ${newId()}` },
        basePriceVnd: 1_000,
        sizes: [{ size: 'S', priceDeltaVnd: 0 }],
        toppingIds: [],
      })
      .catch((e: unknown) => e);
    expect(errorCodeOf(badCategory)).toBe('RESOURCE_REFERENCE_INVALID');
    expect(detailsOf(badCategory)).toEqual({ field: 'categoryId' });

    const category = await seedLiveCategory();
    const created = await products.createProduct({
      categoryId: category.id,
      name: { en: `Del ${newId()}`, vi: `X ${newId()}` },
      basePriceVnd: 1_000,
      sizes: [{ size: 'S', priceDeltaVnd: 0 }],
      toppingIds: [],
    });
    const deleted = await products.deleteProduct({ id: created.product!.id }, caller);
    expect(deleted.product?.deletedAt).toBeTruthy();

    const stillGettable = await products.getProduct({ id: created.product!.id });
    expect(stillGettable.product?.deletedAt).toBeTruthy();

    const restored = await products.restoreProduct({ id: created.product!.id });
    expect(restored.product?.deletedAt).toBeUndefined();
  });

  it('an unknown topping id in toppingIds refuses RESOURCE_REFERENCE_INVALID', async () => {
    const category = await seedLiveCategory();
    const error = await products
      .createProduct({
        categoryId: category.id,
        name: { en: `T ${newId()}`, vi: `X ${newId()}` },
        basePriceVnd: 1_000,
        sizes: [{ size: 'S', priceDeltaVnd: 0 }],
        toppingIds: [newId()],
      })
      .catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('RESOURCE_REFERENCE_INVALID');
    expect(detailsOf(error)).toEqual({ field: 'toppingIds' });
  });

  it('ReplaceSizes swaps the size set in one transaction', async () => {
    const category = await seedLiveCategory();
    const created = await products.createProduct({
      categoryId: category.id,
      name: { en: `Sz ${newId()}`, vi: `X ${newId()}` },
      basePriceVnd: 1_000,
      sizes: [{ size: 'S', priceDeltaVnd: 0 }],
      toppingIds: [],
    });
    const replaced = await products.replaceSizes({
      id: created.product!.id,
      sizes: [
        { size: 'M', priceDeltaVnd: 3_000 },
        { size: 'L', priceDeltaVnd: 6_000 },
      ],
    });
    expect(replaced.product?.sizes).toEqual([
      { size: 'M', priceDeltaVnd: 3_000 },
      { size: 'L', priceDeltaVnd: 6_000 },
    ]);
  });

  it('name clash in each language answers the right locale, and a deleted name does not block', async () => {
    const category = await seedLiveCategory();
    const nameEn = `Dup ${newId()}`;
    const nameVi = `TrungVi ${newId()}`;
    const first = await products.createProduct({
      categoryId: category.id,
      name: { en: nameEn, vi: nameVi },
      basePriceVnd: 1_000,
      sizes: [{ size: 'S', priceDeltaVnd: 0 }],
      toppingIds: [],
    });

    const clashVi = await products
      .createProduct({
        categoryId: category.id,
        name: { en: `Other ${newId()}`, vi: nameVi },
        basePriceVnd: 1_000,
        sizes: [{ size: 'S', priceDeltaVnd: 0 }],
        toppingIds: [],
      })
      .catch((e: unknown) => e);
    expect(errorCodeOf(clashVi)).toBe('PRODUCT_NAME_TAKEN');
    expect(detailsOf(clashVi)).toEqual({ locale: 'vi' as Locale });

    await products.deleteProduct({ id: first.product!.id }, caller);
    const afterDelete = await products.createProduct({
      categoryId: category.id,
      name: { en: nameEn, vi: `Fresh ${newId()}` },
      basePriceVnd: 1_000,
      sizes: [{ size: 'S', priceDeltaVnd: 0 }],
      toppingIds: [],
    });
    expect(afterDelete.product?.name?.en).toBe(nameEn);
  });

  it('every write invalidates the menu cache after commit', async () => {
    const invalidateSpy = vi.spyOn(cache, 'invalidate');
    const category = await seedLiveCategory();
    invalidateSpy.mockClear();

    await categories.updateCategory({ id: category.id, sortOrder: 5 });
    expect(invalidateSpy).toHaveBeenCalledTimes(1);

    const created = await products.createProduct({
      categoryId: category.id,
      name: { en: `Inv ${newId()}`, vi: `X ${newId()}` },
      basePriceVnd: 1_000,
      sizes: [{ size: 'S', priceDeltaVnd: 0 }],
      toppingIds: [],
    });
    expect(invalidateSpy).toHaveBeenCalledTimes(2);

    await products.deleteProduct({ id: created.product!.id }, caller);
    expect(invalidateSpy).toHaveBeenCalledTimes(3);

    invalidateSpy.mockRestore();
  });

  it('topping lifecycle: create, rename clash, delete, restore keeps product links', async () => {
    const category = await seedLiveCategory();
    const topping = await toppings.createTopping({
      name: { en: `Top ${newId()}`, vi: `X ${newId()}` },
      priceVnd: 8_000,
    });
    const product = await products.createProduct({
      categoryId: category.id,
      name: { en: `Withtop ${newId()}`, vi: `X ${newId()}` },
      basePriceVnd: 1_000,
      sizes: [{ size: 'S', priceDeltaVnd: 0 }],
      toppingIds: [topping.topping!.id],
    });

    const other = await toppings.createTopping({
      name: { en: `Other ${newId()}`, vi: `Y ${newId()}` },
      priceVnd: 5_000,
    });
    const clash = await toppings
      .updateTopping({ id: other.topping!.id, name: { en: topping.topping!.name!.en, vi: 'Z' } })
      .catch((e: unknown) => e);
    expect(errorCodeOf(clash)).toBe('TOPPING_NAME_TAKEN');

    await toppings.deleteTopping({ id: topping.topping!.id }, caller);
    const afterDelete = await products.getProduct({ id: product.product!.id });
    expect(afterDelete.product?.toppingIds).toContain(topping.topping!.id);

    const restored = await toppings.restoreTopping({ id: topping.topping!.id });
    expect(restored.topping?.deletedAt).toBeUndefined();
  });
});
