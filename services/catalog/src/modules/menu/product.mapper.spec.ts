import { describe, expect, it } from 'vitest';
import type { ProductDetailRow, ProductSummaryRow } from './product.mapper.js';
import { toProtoProductDetail, toProtoProductSummary } from './product.mapper.js';

function summaryRow(overrides: Partial<ProductSummaryRow> = {}): ProductSummaryRow {
  return {
    id: '01a0d799-fda1-7c3e-8da5-3b5de192d879',
    categoryId: '01a0d799-fda1-7c3e-8da5-3b5de192d880',
    nameEn: 'Iced milk coffee',
    nameVi: 'Cà phê sữa đá',
    basePriceVnd: 29_000,
    imagePath: null,
    isAvailable: true,
    stockQty: null,
    sizes: [{ priceDeltaVnd: 0 }],
    ...overrides,
  };
}

describe('toProtoProductSummary', () => {
  it('isSoldOut when isAvailable is false', () => {
    expect(toProtoProductSummary(summaryRow({ isAvailable: false }), undefined).isSoldOut).toBe(
      true,
    );
  });

  it('isSoldOut when stockQty is 0', () => {
    expect(toProtoProductSummary(summaryRow({ stockQty: 0 }), undefined).isSoldOut).toBe(true);
  });

  it('not sold out when stockQty is null (uncounted)', () => {
    expect(toProtoProductSummary(summaryRow({ stockQty: null }), undefined).isSoldOut).toBe(false);
  });

  it('fromPriceVnd is base price plus the smallest size delta', () => {
    const row = summaryRow({
      basePriceVnd: 35_000,
      sizes: [{ priceDeltaVnd: 6_000 }, { priceDeltaVnd: 0 }, { priceDeltaVnd: 10_000 }],
    });
    expect(toProtoProductSummary(row, undefined).fromPriceVnd).toBe(35_000);
  });

  it('carries the imageUrl it is given', () => {
    expect(toProtoProductSummary(summaryRow(), 'http://localhost:29199/x').imageUrl).toBe(
      'http://localhost:29199/x',
    );
  });

  it('imageUrl is undefined when none is given', () => {
    expect(toProtoProductSummary(summaryRow(), undefined).imageUrl).toBeUndefined();
  });
});

function detailRow(overrides: Partial<ProductDetailRow> = {}): ProductDetailRow {
  return {
    ...summaryRow(),
    descriptionEn: null,
    descriptionVi: null,
    sizes: [
      { size: 'L', priceDeltaVnd: 10_000 },
      { size: 'S', priceDeltaVnd: 0 },
      { size: 'M', priceDeltaVnd: 6_000 },
    ],
    toppings: [],
    ...overrides,
  };
}

describe('toProtoProductDetail', () => {
  it('sizes come out S, M, L regardless of row order', () => {
    const detail = toProtoProductDetail(detailRow(), undefined);
    expect(detail.sizes.map((s) => s.size)).toEqual(['S', 'M', 'L']);
  });

  it('description is undefined when both columns are null', () => {
    const detail = toProtoProductDetail(
      detailRow({ descriptionEn: null, descriptionVi: null }),
      undefined,
    );
    expect(detail.description).toBeUndefined();
  });

  it('description carries both languages when set', () => {
    const detail = toProtoProductDetail(
      detailRow({ descriptionEn: 'Sweet and cold', descriptionVi: 'Ngọt và lạnh' }),
      undefined,
    );
    expect(detail.description).toEqual({ en: 'Sweet and cold', vi: 'Ngọt và lạnh' });
  });

  it('maps allowed toppings', () => {
    const detail = toProtoProductDetail(
      detailRow({
        toppings: [
          {
            topping: {
              id: '01a0d799-fda1-7c3e-8da5-3b5de192d881',
              nameEn: 'Black pearls',
              nameVi: 'Trân châu đen',
              priceVnd: 8_000,
            },
          },
        ],
      }),
      undefined,
    );
    expect(detail.toppings).toEqual([
      {
        id: '01a0d799-fda1-7c3e-8da5-3b5de192d881',
        name: { en: 'Black pearls', vi: 'Trân châu đen' },
        priceVnd: 8_000,
      },
    ]);
  });
});
