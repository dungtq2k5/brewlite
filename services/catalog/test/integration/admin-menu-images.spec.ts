import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { getStorage } from 'firebase-admin/storage';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { AdminMenuModule } from '../../src/modules/admin-menu/admin-menu.module.js';
import { AdminProductsService } from '../../src/modules/admin-menu/admin-products.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const NOT_AN_IMAGE = Uint8Array.from(Buffer.from('%PDF-1.4'));

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

async function objectsUnder(productId: string): Promise<string[]> {
  const [files] = await getStorage()
    .bucket()
    .getFiles({ prefix: `products/${productId}/` });
  return files.map((f) => f.name);
}

async function seedLiveProduct() {
  const category = await prisma.category.create({
    data: { id: newId(), nameEn: `Cat ${newId()}`, nameVi: `Danh muc ${newId()}` },
  });
  return prisma.product.create({
    data: {
      id: newId(),
      categoryId: category.id,
      nameEn: `P ${newId()}`,
      nameVi: `S ${newId()}`,
      basePriceVnd: 20_000,
      sizes: { create: [{ size: 'S', priceDeltaVnd: 0 }] },
    },
  });
}

describe('AdminMenuService — images, against the Storage emulator', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let products: AdminProductsService;

  beforeAll(async () => {
    app = await buildModule();
    products = app.get(AdminProductsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('uploads and returns an imageUrl pointing at the new object', async () => {
    const product = await seedLiveProduct();
    const result = await products.setImage({
      id: product.id,
      content: JPEG,
      contentType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(result.product?.imageUrl).toContain(`products%2F${product.id}%2F`);
    expect(await objectsUnder(product.id)).toHaveLength(1);
  });

  it('bytes that are not a real image type refuse 422 IMAGE_INVALID TYPE', async () => {
    const product = await seedLiveProduct();
    const error = await products
      .setImage({
        id: product.id,
        content: NOT_AN_IMAGE,
        contentType: 'image/jpeg',
        extension: 'jpg',
      })
      .catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('IMAGE_INVALID');
    expect(detailsOf(error)).toEqual({ reason: 'TYPE' });
    expect(await objectsUnder(product.id)).toHaveLength(0);
  });

  it('replacing an image deletes the old object — exactly one remains', async () => {
    const product = await seedLiveProduct();
    await products.setImage({
      id: product.id,
      content: JPEG,
      contentType: 'image/jpeg',
      extension: 'jpg',
    });
    await products.setImage({
      id: product.id,
      content: PNG,
      contentType: 'image/png',
      extension: 'png',
    });
    const remaining = await objectsUnder(product.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatch(/\.png$/);
  });

  it('ClearImage removes the object and the imageUrl', async () => {
    const product = await seedLiveProduct();
    await products.setImage({
      id: product.id,
      content: JPEG,
      contentType: 'image/jpeg',
      extension: 'jpg',
    });
    const cleared = await products.clearImage({ id: product.id });
    expect(cleared.product?.imageUrl).toBeUndefined();
    expect(await objectsUnder(product.id)).toHaveLength(0);
  });

  it('a DB failure after upload deletes the new object, leaving the row untouched', async () => {
    const product = await seedLiveProduct();
    const prismaService = app.get(PrismaService);
    const updateSpy = vi
      .spyOn(prismaService.product, 'update')
      .mockRejectedValueOnce(new Error('simulated DB failure'));

    const error = await products
      .setImage({ id: product.id, content: JPEG, contentType: 'image/jpeg', extension: 'jpg' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(await objectsUnder(product.id)).toHaveLength(0);

    updateSpy.mockRestore();
    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.imagePath).toBeNull();
  });

  it('SetImage on a deleted product refuses INVALID_STATE DELETED', async () => {
    const product = await seedLiveProduct();
    await prisma.product.update({
      where: { id: product.id },
      data: { deletedAt: new Date(), deletedById: newId() },
    });
    const error = await products
      .setImage({ id: product.id, content: JPEG, contentType: 'image/jpeg', extension: 'jpg' })
      .catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('INVALID_STATE');
    expect(detailsOf(error)).toEqual({ status: 'DELETED' });
  });
});
