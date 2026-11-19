import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId, Role } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { AdminMenuGrpcController } from '../../src/modules/admin-menu/admin-menu-grpc.controller.js';
import { AdminMenuModule } from '../../src/modules/admin-menu/admin-menu.module.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

// Every AdminMenuService RPC through the gRPC controller, against the real test database
// (conventions §16.2): the refusals and branches admin-menu.spec.ts does not reach.

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

async function refusal(promise: Promise<unknown>): Promise<{ code?: string; details?: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected a refusal, got a response');
    },
    (e: unknown) => e,
  );
  if (!(error && typeof error === 'object' && 'getError' in error)) throw error;
  const { metadata } = (error as RpcException).getError() as { metadata: Metadata };
  const code = metadata.get('bl-error-code')[0] as string | undefined;
  const [raw] = metadata.get('bl-error-details-bin');
  const details =
    raw === undefined
      ? undefined
      : (JSON.parse(
          (Buffer.isBuffer(raw) ? raw : Buffer.from(raw as string, 'binary')).toString('utf8'),
        ) as unknown);
  return { code, details };
}

function adminMetadata(): Metadata {
  const metadata = new Metadata();
  metadata.set('x-user-id', newId());
  metadata.set('x-user-role', Role.ADMIN);
  return metadata;
}

const softDeleted = () => ({ deletedAt: new Date(), deletedById: newId() });

async function seedCategory(nameEn = 'Coffee', extra: Record<string, unknown> = {}) {
  return prisma.category.create({
    data: { id: newId(), nameEn, nameVi: `${nameEn} vi`, ...extra },
  });
}

async function seedTopping(nameEn = 'Boba', extra: Record<string, unknown> = {}) {
  return prisma.topping.create({
    data: { id: newId(), nameEn, nameVi: `${nameEn} vi`, priceVnd: 8_000, ...extra },
  });
}

async function seedProduct(
  categoryId: string,
  nameEn = 'Latte',
  extra: Record<string, unknown> = {},
) {
  return prisma.product.create({
    data: {
      id: newId(),
      categoryId,
      nameEn,
      nameVi: `${nameEn} vi`,
      basePriceVnd: 30_000,
      sizes: { create: [{ size: 'S', priceDeltaVnd: 0 }] },
      ...extra,
    },
  });
}

describe('AdminMenuGrpcController', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let rpc: AdminMenuGrpcController;

  beforeAll(async () => {
    app = await buildModule();
    rpc = app.get(AdminMenuGrpcController);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('categories', () => {
    it('ListCategories returns live rows by sortOrder, and only DELETED ones when asked', async () => {
      const second = await seedCategory('Tea', { sortOrder: 2 });
      const first = await seedCategory('Coffee', { sortOrder: 1 });
      const gone = await seedCategory('Juice', softDeleted());

      const live = await rpc.listCategories({});
      expect(live.categories.map((c) => c.id)).toEqual([first.id, second.id]);

      const deleted = await rpc.listCategories({ deleted: true });
      expect(deleted.categories.map((c) => c.id)).toEqual([gone.id]);
    });

    it('CreateCategory keeps a given sortOrder and isActive, and a Vietnamese clash names VI', async () => {
      const created = await rpc.createCategory({
        name: { en: 'Smoothies', vi: 'Sinh to' },
        sortOrder: 7,
        isActive: false,
      });
      expect(created.category).toMatchObject({ sortOrder: 7, isActive: false });

      const clash = await refusal(rpc.createCategory({ name: { en: 'Other', vi: 'Sinh to' } }));
      expect(clash).toEqual({ code: 'CATEGORY_NAME_TAKEN', details: { locale: 'vi' } });
    });

    it('UpdateCategory changes only the fields given', async () => {
      const category = await seedCategory('Coffee', { sortOrder: 3 });
      const renamed = await rpc.updateCategory({
        id: category.id,
        name: { en: 'Espresso', vi: 'Ca phe may' },
      });
      expect(renamed.category).toMatchObject({
        name: { en: 'Espresso', vi: 'Ca phe may' },
        sortOrder: 3,
        isActive: true,
      });

      const deactivated = await rpc.updateCategory({ id: category.id, isActive: false });
      expect(deactivated.category).toMatchObject({ name: { en: 'Espresso' }, isActive: false });
    });

    it('UpdateCategory refuses a name another live category has', async () => {
      await seedCategory('Coffee');
      const other = await seedCategory('Tea');
      const clash = await refusal(
        rpc.updateCategory({ id: other.id, name: { en: 'Coffee', vi: 'Tra moi' } }),
      );
      expect(clash).toEqual({ code: 'CATEGORY_NAME_TAKEN', details: { locale: 'en' } });
    });

    it('a DELETED category refuses update and a second delete; a live one refuses restore', async () => {
      const gone = await seedCategory('Juice', softDeleted());
      const live = await seedCategory('Coffee');

      expect(await refusal(rpc.updateCategory({ id: gone.id, sortOrder: 1 }))).toEqual({
        code: 'INVALID_STATE',
        details: { status: 'DELETED' },
      });
      expect(await refusal(rpc.deleteCategory({ id: gone.id }, adminMetadata()))).toEqual({
        code: 'INVALID_STATE',
        details: { status: 'DELETED' },
      });
      expect(await refusal(rpc.restoreCategory({ id: live.id }))).toEqual({
        code: 'INVALID_STATE',
        details: { status: 'ACTIVE' },
      });
    });

    it('RestoreCategory refuses when a live category took its name meanwhile', async () => {
      const gone = await seedCategory('Coffee', softDeleted());
      await seedCategory('Coffee');
      expect(await refusal(rpc.restoreCategory({ id: gone.id }))).toEqual({
        code: 'CATEGORY_NAME_TAKEN',
        details: { locale: 'en' },
      });
      const row = await prisma.category.findUniqueOrThrow({ where: { id: gone.id } });
      expect(row.deletedAt).not.toBeNull();
    });

    it('DeleteCategory stamps the caller from metadata, and refuses with NO caller', async () => {
      const category = await seedCategory('Coffee');

      expect(await refusal(rpc.deleteCategory({ id: category.id }))).toEqual({
        code: 'UNAUTHENTICATED',
        details: undefined,
      });
      const untouched = await prisma.category.findUniqueOrThrow({ where: { id: category.id } });
      expect(untouched.deletedAt).toBeNull();

      const metadata = adminMetadata();
      const deleted = await rpc.deleteCategory({ id: category.id }, metadata);
      expect(deleted.category?.deletedById).toBe(metadata.get('x-user-id')[0]);
    });

    it('an unknown category id answers RESOURCE_NOT_FOUND', async () => {
      expect(await refusal(rpc.updateCategory({ id: newId(), sortOrder: 1 }))).toEqual({
        code: 'RESOURCE_NOT_FOUND',
        details: { resource: 'CATEGORY' },
      });
    });
  });

  describe('toppings', () => {
    it('ListToppings returns live rows by English name, and only DELETED ones when asked', async () => {
      const pearl = await seedTopping('Pearl');
      const aloe = await seedTopping('Aloe');
      const gone = await seedTopping('Jelly', softDeleted());

      expect((await rpc.listToppings({})).toppings.map((t) => t.id)).toEqual([aloe.id, pearl.id]);
      expect((await rpc.listToppings({ deleted: true })).toppings.map((t) => t.id)).toEqual([
        gone.id,
      ]);
    });

    it('CreateTopping refuses a clash in each language with the right locale', async () => {
      await rpc.createTopping({ name: { en: 'Boba', vi: 'Tran chau' }, priceVnd: 8_000 });

      expect(
        await refusal(rpc.createTopping({ name: { en: 'Boba', vi: 'Khac' }, priceVnd: 1 })),
      ).toEqual({ code: 'TOPPING_NAME_TAKEN', details: { locale: 'en' } });
      expect(
        await refusal(rpc.createTopping({ name: { en: 'Other', vi: 'Tran chau' }, priceVnd: 1 })),
      ).toEqual({ code: 'TOPPING_NAME_TAKEN', details: { locale: 'vi' } });
    });

    it('UpdateTopping changes price and availability, keeping the name', async () => {
      const topping = await seedTopping('Boba');
      const updated = await rpc.updateTopping({
        id: topping.id,
        priceVnd: 12_000,
        isAvailable: false,
      });
      expect(updated.topping).toMatchObject({
        name: { en: 'Boba' },
        priceVnd: 12_000,
        isAvailable: false,
      });
    });

    it('a DELETED topping refuses update and a second delete; a live one refuses restore', async () => {
      const gone = await seedTopping('Jelly', softDeleted());
      const live = await seedTopping('Boba');

      expect(await refusal(rpc.updateTopping({ id: gone.id, priceVnd: 1 }))).toEqual({
        code: 'INVALID_STATE',
        details: { status: 'DELETED' },
      });
      expect(await refusal(rpc.deleteTopping({ id: gone.id }, adminMetadata()))).toEqual({
        code: 'INVALID_STATE',
        details: { status: 'DELETED' },
      });
      expect(await refusal(rpc.restoreTopping({ id: live.id }))).toEqual({
        code: 'INVALID_STATE',
        details: { status: 'ACTIVE' },
      });
    });

    it('RestoreTopping refuses when a live topping took its name meanwhile', async () => {
      const gone = await seedTopping('Boba', softDeleted());
      await prisma.topping.create({
        data: { id: newId(), nameEn: 'Other', nameVi: 'Boba vi', priceVnd: 1 },
      });
      expect(await refusal(rpc.restoreTopping({ id: gone.id }))).toEqual({
        code: 'TOPPING_NAME_TAKEN',
        details: { locale: 'vi' },
      });
    });

    it('DeleteTopping refuses with NO caller and an unknown id answers RESOURCE_NOT_FOUND', async () => {
      const topping = await seedTopping('Boba');
      expect((await refusal(rpc.deleteTopping({ id: topping.id }))).code).toBe('UNAUTHENTICATED');
      expect(await refusal(rpc.restoreTopping({ id: newId() }))).toEqual({
        code: 'RESOURCE_NOT_FOUND',
        details: { resource: 'TOPPING' },
      });
    });
  });

  describe('products', () => {
    it('ListProducts filters by category and search term, sorts, pages and counts', async () => {
      const coffee = await seedCategory('Coffee');
      const tea = await seedCategory('Tea');
      const latte = await seedProduct(coffee.id, 'Latte', { basePriceVnd: 35_000 });
      const mocha = await seedProduct(coffee.id, 'Mocha latte', { basePriceVnd: 45_000 });
      await seedProduct(coffee.id, 'Americano', { basePriceVnd: 25_000 });
      await seedProduct(tea.id, 'Matcha latte');

      const searched = await rpc.listProducts({
        page: { page: 1, pageSize: 20, sort: '-basePriceVnd' },
        categoryId: coffee.id,
        q: 'LATTE',
      });
      expect(searched.products.map((p) => p.id)).toEqual([mocha.id, latte.id]);
      expect(searched.meta).toEqual({ page: 1, pageSize: 20, total: 2 });

      const secondPage = await rpc.listProducts({
        page: { page: 2, pageSize: 1, sort: 'basePriceVnd' },
        categoryId: coffee.id,
      });
      expect(secondPage.products.map((p) => p.id)).toEqual([latte.id]);
      expect(secondPage.meta).toEqual({ page: 2, pageSize: 1, total: 3 });
    });

    it('ListProducts treats % and _ in the search term as LITERAL characters', async () => {
      const category = await seedCategory('Coffee');
      const literal = await seedProduct(category.id, '100% Arabica');
      await seedProduct(category.id, '100 Robusta');
      const underscored = await seedProduct(category.id, 'Cold_brew');
      await seedProduct(category.id, 'Coldxbrew');

      const percent = await rpc.listProducts({ page: undefined, q: '100%' });
      expect(percent.products.map((p) => p.id)).toEqual([literal.id]);

      const underscore = await rpc.listProducts({ page: undefined, q: 'd_b' });
      expect(underscore.products.map((p) => p.id)).toEqual([underscored.id]);
    });

    it('ListProducts with deleted returns only soft-deleted products', async () => {
      const category = await seedCategory('Coffee');
      await seedProduct(category.id, 'Latte');
      const gone = await seedProduct(category.id, 'Mocha', softDeleted());

      const deleted = await rpc.listProducts({ page: undefined, deleted: true });
      expect(deleted.products.map((p) => p.id)).toEqual([gone.id]);
      expect(deleted.meta?.total).toBe(1);
    });

    it('CreateProduct keeps a description, stock, sort order and live toppings', async () => {
      const category = await seedCategory('Coffee');
      const boba = await seedTopping('Boba');
      const created = await rpc.createProduct({
        categoryId: category.id,
        name: { en: 'Latte', vi: 'Latte vi' },
        description: { en: 'Milk coffee', vi: 'Ca phe sua' },
        basePriceVnd: 30_000,
        sizes: [{ size: 'S', priceDeltaVnd: 0 }],
        toppingIds: [boba.id],
        stockQty: 12,
        sortOrder: 4,
      });
      expect(created.product).toMatchObject({
        description: { en: 'Milk coffee', vi: 'Ca phe sua' },
        stockQty: 12,
        sortOrder: 4,
        toppingIds: [boba.id],
        categoryNameEn: 'Coffee',
      });
    });

    it('UpdateProduct moves category and changes name, description, price and sort order', async () => {
      const coffee = await seedCategory('Coffee');
      const tea = await seedCategory('Tea');
      const product = await seedProduct(coffee.id, 'Latte');

      const updated = await rpc.updateProduct({
        id: product.id,
        categoryId: tea.id,
        name: { en: 'Chai latte', vi: 'Tra sua' },
        description: { en: 'Spiced', vi: 'Gia vi' },
        basePriceVnd: 40_000,
        sortOrder: 9,
      });
      expect(updated.product).toMatchObject({
        categoryId: tea.id,
        name: { en: 'Chai latte', vi: 'Tra sua' },
        description: { en: 'Spiced', vi: 'Gia vi' },
        basePriceVnd: 40_000,
        sortOrder: 9,
      });

      const cleared = await rpc.updateProduct({
        id: product.id,
        clearDescription: true,
        description: { en: 'ignored', vi: 'ignored' },
      });
      expect(cleared.product?.description).toBeUndefined();
      expect(cleared.product?.basePriceVnd).toBe(40_000);
    });

    it('UpdateProduct refuses a move to a DELETED or unknown category', async () => {
      const coffee = await seedCategory('Coffee');
      const gone = await seedCategory('Juice', softDeleted());
      const product = await seedProduct(coffee.id);

      for (const categoryId of [gone.id, newId()]) {
        expect(await refusal(rpc.updateProduct({ id: product.id, categoryId }))).toEqual({
          code: 'RESOURCE_REFERENCE_INVALID',
          details: { field: 'categoryId' },
        });
      }
      const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(row.categoryId).toBe(coffee.id);
    });

    it('UpdateProduct refuses a name another live product has', async () => {
      const category = await seedCategory('Coffee');
      await seedProduct(category.id, 'Latte');
      const other = await seedProduct(category.id, 'Mocha');
      expect(
        await refusal(rpc.updateProduct({ id: other.id, name: { en: 'Latte', vi: 'Moi' } })),
      ).toEqual({ code: 'PRODUCT_NAME_TAKEN', details: { locale: 'en' } });
    });

    it('a DELETED product refuses every edit', async () => {
      const category = await seedCategory('Coffee');
      const gone = await seedProduct(category.id, 'Latte', softDeleted());
      const id = gone.id;
      const deletedState = { code: 'INVALID_STATE', details: { status: 'DELETED' } };

      expect(await refusal(rpc.updateProduct({ id, sortOrder: 1 }))).toEqual(deletedState);
      expect(await refusal(rpc.replaceSizes({ id, sizes: [] }))).toEqual(deletedState);
      expect(await refusal(rpc.replaceToppings({ id, toppingIds: [] }))).toEqual(deletedState);
      expect(await refusal(rpc.clearImage({ id }))).toEqual(deletedState);
      expect(
        await refusal(
          rpc.setImage({
            id,
            content: new Uint8Array(),
            contentType: 'image/jpeg',
            extension: 'jpg',
          }),
        ),
      ).toEqual(deletedState);
      expect(await refusal(rpc.deleteProduct({ id }, adminMetadata()))).toEqual(deletedState);
    });

    it('ReplaceToppings swaps the links, refuses a deleted topping, and empties with []', async () => {
      const category = await seedCategory('Coffee');
      const boba = await seedTopping('Boba');
      const aloe = await seedTopping('Aloe');
      const jelly = await seedTopping('Jelly', softDeleted());
      const product = await seedProduct(category.id);

      const replaced = await rpc.replaceToppings({
        id: product.id,
        toppingIds: [boba.id, aloe.id],
      });
      expect(replaced.product?.toppingIds).toHaveLength(2);
      expect(replaced.product?.toppingIds).toEqual(expect.arrayContaining([boba.id, aloe.id]));

      expect(
        await refusal(rpc.replaceToppings({ id: product.id, toppingIds: [boba.id, jelly.id] })),
      ).toEqual({ code: 'RESOURCE_REFERENCE_INVALID', details: { field: 'toppingIds' } });
      expect(await prisma.productTopping.count({ where: { productId: product.id } })).toBe(2);

      const emptied = await rpc.replaceToppings({ id: product.id, toppingIds: [] });
      expect(emptied.product?.toppingIds).toEqual([]);
    });

    it('RestoreProduct refuses a live product, a product in a DELETED category, and a taken name', async () => {
      const coffee = await seedCategory('Coffee');
      const live = await seedProduct(coffee.id, 'Latte');
      expect(await refusal(rpc.restoreProduct({ id: live.id }))).toEqual({
        code: 'INVALID_STATE',
        details: { status: 'ACTIVE' },
      });

      const juice = await seedCategory('Juice', softDeleted());
      const orphan = await seedProduct(juice.id, 'Orange', softDeleted());
      expect(await refusal(rpc.restoreProduct({ id: orphan.id }))).toEqual({
        code: 'INVALID_STATE',
        details: { status: 'CATEGORY_DELETED' },
      });

      const twin = await prisma.product.create({
        data: {
          id: newId(),
          categoryId: coffee.id,
          nameEn: 'Twin',
          nameVi: 'Latte vi',
          basePriceVnd: 1,
          ...softDeleted(),
        },
      });
      expect(await refusal(rpc.restoreProduct({ id: twin.id }))).toEqual({
        code: 'PRODUCT_NAME_TAKEN',
        details: { locale: 'vi' },
      });
    });

    it('DeleteProduct refuses with NO caller and an unknown id answers RESOURCE_NOT_FOUND', async () => {
      const category = await seedCategory('Coffee');
      const product = await seedProduct(category.id);
      expect((await refusal(rpc.deleteProduct({ id: product.id }))).code).toBe('UNAUTHENTICATED');
      expect(await refusal(rpc.getProduct({ id: newId() }))).toEqual({
        code: 'RESOURCE_NOT_FOUND',
        details: { resource: 'PRODUCT' },
      });
    });

    it('ClearImage on a product without an image succeeds and leaves no imageUrl', async () => {
      const category = await seedCategory('Coffee');
      const product = await seedProduct(category.id);
      const cleared = await rpc.clearImage({ id: product.id });
      expect(cleared.product?.imageUrl).toBeUndefined();
    });
  });
});
