import { z } from 'zod';

export const localizedTextSchema = z.object({
  vi: z.string().trim().min(1, 'Vui lòng nhập nội dung Tiếng Việt / Vietnamese text required'),
  en: z.string().trim().min(1, 'Vui lòng nhập nội dung Tiếng Anh / English text required'),
});

export const optionalLocalizedTextSchema = z
  .object({
    vi: z.string().trim().default(''),
    en: z.string().trim().default(''),
  })
  .optional()
  .nullable()
  .transform((val) => {
    if (!val) return undefined;
    if (!val.vi && !val.en) return undefined;
    return val;
  })
  .refine(
    (val) => {
      if (!val) return true;
      return val.vi.length > 0 && val.en.length > 0;
    },
    {
      message:
        'Vui lòng nhập cả Tiếng Việt và Tiếng Anh nếu điền mô tả / Enter both languages if providing description',
    },
  );

export const createCategorySchema = z.object({
  name: localizedTextSchema,
  sortOrder: z.number().int().min(0).max(32767).optional(),
  isActive: z.boolean().optional(),
});

export const createToppingSchema = z.object({
  name: localizedTextSchema,
  priceVnd: z.number().int().min(0).max(10_000_000),
});

export const updateToppingSchema = createToppingSchema.partial().extend({
  isAvailable: z.boolean().optional(),
});

export const productSizeItemSchema = z.object({
  size: z.enum(['S', 'M', 'L']),
  priceDeltaVnd: z.number().int().min(0).max(10_000_000),
});

export const createProductSchema = z.object({
  categoryId: z.string().min(1),
  name: localizedTextSchema,
  description: optionalLocalizedTextSchema,
  basePriceVnd: z.number().int().min(0).max(10_000_000),
  sizes: z.array(productSizeItemSchema).min(1).max(3),
  toppingIds: z.array(z.string()).max(100),
  stockQty: z.number().int().min(0).nullable().optional(),
  sortOrder: z.number().int().min(0).max(32767).optional(),
});

export const updateProductSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: localizedTextSchema.optional(),
  description: optionalLocalizedTextSchema,
  basePriceVnd: z.number().int().min(0).max(10_000_000).optional(),
  sortOrder: z.number().int().min(0).max(32767).optional(),
});

export const replaceSizesSchema = z.object({
  sizes: z.array(productSizeItemSchema).min(1).max(3),
});

export const createPromotionSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, 'Mã khuyến mãi phải có ít nhất 3 ký tự / Code must be at least 3 characters')
      .max(32, 'Mã khuyến mãi tối đa 32 ký tự / Code max 32 characters')
      .regex(
        /^[A-Z0-9]{3,32}$/,
        'Mã khuyến mãi chỉ chứa chữ hoa và số (A-Z, 0-9) / Code must be uppercase alphanumeric',
      ),
    description: z
      .string()
      .trim()
      .max(200, 'Mô tả tối đa 200 ký tự / Description max 200 characters')
      .optional()
      .transform((val) => (val && val.length > 0 ? val : undefined)),
    discountType: z.enum(['PERCENT', 'FIXED']),
    discountValue: z.number().int().min(1, 'Giá trị giảm tối thiểu là 1 / Min value is 1').max(10_000_000),
    maxDiscountVnd: z.number().int().min(0).optional().nullable(),
    minSubtotalVnd: z.number().int().min(0).optional().nullable(),
    startsAt: z.string().min(1, 'Vui lòng chọn thời gian bắt đầu / Start date is required'),
    endsAt: z.string().min(1, 'Vui lòng chọn thời gian kết thúc / End date is required'),
    maxUses: z.number().int().nonnegative().optional().nullable(),
    perUserLimit: z.number().int().nonnegative().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.discountType === 'PERCENT') {
        return data.discountValue >= 1 && data.discountValue <= 100;
      }
      return data.discountValue >= 1 && data.discountValue <= 10_000_000;
    },
    {
      message: 'Mức giảm theo phần trăm phải từ 1% đến 100% / Percent discount must be between 1 and 100',
      path: ['discountValue'],
    },
  )
  .refine(
    (data) => {
      const start = new Date(data.startsAt).getTime();
      const end = new Date(data.endsAt).getTime();
      return !isNaN(start) && !isNaN(end) && end > start;
    },
    {
      message: 'Thời gian kết thúc phải diễn ra sau thời gian bắt đầu / End date must be after start date',
      path: ['endsAt'],
    },
  );

export const updatePromotionSchema = z.object({
  description: z
    .string()
    .trim()
    .max(200, 'Mô tả tối đa 200 ký tự / Description max 200 characters')
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  clearDescription: z.boolean().optional(),
  endsAt: z.string().min(1, 'Vui lòng chọn thời gian kết thúc / End date is required').optional(),
  maxUses: z.number().int().nonnegative().optional().nullable(),
  perUserLimit: z.number().int().nonnegative().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const lockUserSchema = z.object({
  reason: z.string().trim().min(3, 'Lý do khóa phải có ít nhất 3 ký tự / Reason min 3 chars'),
  lockedUntil: z.string().optional(),
});

export const cancelPaidSchema = z.object({
  note: z.string().trim().min(3, 'Ghi chú hủy đơn phải có ít nhất 3 ký tự / Note min 3 chars'),
});

export const setStockQtySchema = z.object({
  stockQty: z.number().int().min(0).nullable(),
  expectedVersion: z.number().int().min(0),
});

/**
 * Chuẩn hóa trường nullable từ OpenAPI 3.1 của Orval (string[] | string | null)
 */
export function unwrapNullable<T>(val: T | T[] | null | undefined): T | null {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}