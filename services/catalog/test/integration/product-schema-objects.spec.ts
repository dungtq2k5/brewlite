import { describe, expect, it } from 'vitest';
import { newId } from '@brewlite/contracts';
import { prisma } from '../setup/per-file.js';

async function insertCategory() {
  return prisma.category.create({
    data: { id: newId(), nameEn: 'Coffee', nameVi: 'Cà phê' },
  });
}

async function insertProduct(
  categoryId: string,
  overrides: Partial<{
    nameEn: string;
    nameVi: string;
    descriptionEn: string | null;
    descriptionVi: string | null;
    basePriceVnd: number;
    stockQty: number | null;
  }> = {},
) {
  return prisma.product.create({
    data: {
      id: newId(),
      categoryId,
      nameEn: 'Iced milk coffee',
      nameVi: 'Cà phê sữa đá',
      basePriceVnd: 29_000,
      ...overrides,
    },
  });
}

describe('products C-2 schema objects', () => {
  it('refuses a second LIVE row with the same English name', async () => {
    const category = await insertCategory();
    await insertProduct(category.id);
    await expect(insertProduct(category.id, { nameVi: 'Khác' })).rejects.toThrow();
  });

  it('refuses a second LIVE row with the same Vietnamese name', async () => {
    const category = await insertCategory();
    await insertProduct(category.id);
    await expect(insertProduct(category.id, { nameEn: 'Other' })).rejects.toThrow();
  });

  it('does not block a new row once the old one is soft-deleted', async () => {
    const category = await insertCategory();
    const first = await insertProduct(category.id);
    await prisma.product.update({
      where: { id: first.id },
      data: { deletedAt: new Date(), deletedById: newId() },
    });
    await expect(insertProduct(category.id)).resolves.toMatchObject({ nameEn: 'Iced milk coffee' });
  });

  it('refuses deleted_at without deleted_by_id', async () => {
    const category = await insertCategory();
    const row = await insertProduct(category.id);
    await expect(
      prisma.product.update({ where: { id: row.id }, data: { deletedAt: new Date() } }),
    ).rejects.toThrow();
  });

  it('refuses half a description pair', async () => {
    const category = await insertCategory();
    await expect(
      insertProduct(category.id, { descriptionEn: 'Sweet and cold', descriptionVi: null }),
    ).rejects.toThrow();
  });

  it('refuses a negative price', async () => {
    const category = await insertCategory();
    await expect(insertProduct(category.id, { basePriceVnd: -1 })).rejects.toThrow();
  });

  it('refuses a price over MAX_PRICE_VND', async () => {
    const category = await insertCategory();
    await expect(insertProduct(category.id, { basePriceVnd: 10_000_001 })).rejects.toThrow();
  });

  it('refuses negative stock', async () => {
    const category = await insertCategory();
    await expect(insertProduct(category.id, { stockQty: -1 })).rejects.toThrow();
  });
});

describe('product_sizes C-3 schema objects', () => {
  it('refuses a size outside S, M, L', async () => {
    const category = await insertCategory();
    const product = await insertProduct(category.id);
    await expect(
      prisma.productSize.create({
        data: { productId: product.id, size: 'X', priceDeltaVnd: 0 },
      }),
    ).rejects.toThrow();
  });

  it('refuses a delta over MAX_PRICE_VND', async () => {
    const category = await insertCategory();
    const product = await insertProduct(category.id);
    await expect(
      prisma.productSize.create({
        data: { productId: product.id, size: 'S', priceDeltaVnd: 10_000_001 },
      }),
    ).rejects.toThrow();
  });
});

describe('toppings C-4 schema objects', () => {
  async function insertTopping(
    overrides: Partial<{ nameEn: string; nameVi: string; priceVnd: number }> = {},
  ) {
    return prisma.topping.create({
      data: {
        id: newId(),
        nameEn: 'Black pearls',
        nameVi: 'Trân châu đen',
        priceVnd: 8_000,
        ...overrides,
      },
    });
  }

  it('refuses a second LIVE row with the same English name', async () => {
    await insertTopping();
    await expect(insertTopping({ nameVi: 'Khác' })).rejects.toThrow();
  });

  it('does not block a new row once the old one is soft-deleted', async () => {
    const first = await insertTopping();
    await prisma.topping.update({
      where: { id: first.id },
      data: { deletedAt: new Date(), deletedById: newId() },
    });
    await expect(insertTopping()).resolves.toMatchObject({ nameEn: 'Black pearls' });
  });

  it('refuses deleted_at without deleted_by_id', async () => {
    const row = await insertTopping();
    await expect(
      prisma.topping.update({ where: { id: row.id }, data: { deletedAt: new Date() } }),
    ).rejects.toThrow();
  });

  it('refuses a price over MAX_PRICE_VND', async () => {
    await expect(insertTopping({ priceVnd: 10_000_001 })).rejects.toThrow();
  });
});
