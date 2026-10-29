'use server';

import {
  adminCategoriesControllerCreate,
  adminCategoriesControllerDelete,
  adminCategoriesControllerRestore,
  adminCategoriesControllerUpdate,
  adminProductsControllerClearImage,
  adminProductsControllerCreate,
  adminProductsControllerDelete,
  adminProductsControllerGet,
  adminProductsControllerReplaceSizes,
  adminProductsControllerReplaceToppings,
  adminProductsControllerRestore,
  adminProductsControllerSetImage,
  adminProductsControllerUpdate,
  adminToppingsControllerCreate,
  adminToppingsControllerDelete,
  adminToppingsControllerRestore,
  adminToppingsControllerUpdate,
  adminUsersControllerChangeRole,
  adminUsersControllerCreate,
  adminUsersControllerDeactivate,
  adminUsersControllerLock,
  adminUsersControllerRestore,
  adminUsersControllerUnlock,
  promotionsControllerCreate,
  promotionsControllerDelete,
  promotionsControllerGet,
  promotionsControllerRestore,
  promotionsControllerUpdate,
  type AdminCategoryResponseDto,
  type AdminProductResponseDto,
  type AdminToppingResponseDto,
  type AdminUserResponseDto,
  type PromotionResponseDto,
  type SetProductImageResponseDto,
} from '@brewlite/api-client';
import {
  LOCK_REASON_MAX_LENGTH,
  PRODUCT_IMAGE_MAX_BYTES,
  PROMO_DESCRIPTION_MAX_LENGTH,
} from '@brewlite/contracts';
import { revalidatePath } from 'next/cache';
import { actionFailure, type ActionResult } from './action-result';
import { unwrap } from './api-server';

const IMAGE_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ROLES: ReadonlySet<string> = new Set(['CUSTOMER', 'STAFF', 'ADMIN']);
const DISCOUNT_TYPES: ReadonlySet<string> = new Set(['PERCENT', 'FIXED']);
const SIZES: ReadonlySet<string> = new Set(['S', 'M', 'L']);
const STOCK_MAX = 2_147_483_647;
const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;

type LocalizedInput = { vi: string; en: string };

function invalid(): ActionResult<never> {
  return { ok: false, code: 'VALIDATION_FAILED', details: {} };
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

function cleanLocalized(value: unknown, max: number): LocalizedInput | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const vi = cleanText(row.vi, max);
  const en = cleanText(row.en, max);
  return vi && en ? { vi, en } : null;
}

function cleanOptionalLocalized(value: unknown, max: number): LocalizedInput | null | undefined {
  if (value === null || value === undefined) return value === null ? null : undefined;
  return cleanLocalized(value, max) ?? undefined;
}

function cleanOptionalText(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined) return value === null ? null : undefined;
  return cleanText(value, max) ?? undefined;
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function revalidateAdmin(...paths: string[]): void {
  for (const path of paths) revalidatePath(path);
  revalidatePath('/admin');
}

/* ------------------------------------------------------------------ users */

export async function createAdminUserAction(input: {
  email: string;
  password: string;
  fullName: string;
  role: string;
}): Promise<ActionResult<AdminUserResponseDto>> {
  const email = cleanText(input?.email, 254);
  const fullName = cleanText(input?.fullName, NAME_MAX);
  if (!email || !fullName || typeof input.password !== 'string' || !ROLES.has(input.role)) {
    return invalid();
  }

  try {
    const response = await adminUsersControllerCreate({
      email,
      password: input.password,
      fullName,
      role: input.role as 'CUSTOMER' | 'STAFF' | 'ADMIN',
    });
    revalidateAdmin('/admin/users');
    return { ok: true, data: unwrap<AdminUserResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function changeUserRoleAction(input: {
  userId: string;
  role: string;
}): Promise<ActionResult<AdminUserResponseDto>> {
  if (!isId(input?.userId) || !ROLES.has(input.role)) return invalid();

  try {
    const response = await adminUsersControllerChangeRole(input.userId, {
      role: input.role as 'CUSTOMER' | 'STAFF' | 'ADMIN',
    });
    revalidateAdmin('/admin/users');
    return { ok: true, data: unwrap<AdminUserResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function lockUserAction(input: {
  userId: string;
  reason: string;
  lockedUntil?: string;
}): Promise<ActionResult<AdminUserResponseDto>> {
  const reason = cleanText(input?.reason, LOCK_REASON_MAX_LENGTH);
  if (!isId(input?.userId) || !reason) return invalid();

  let lockedUntil: string | undefined;
  if (input.lockedUntil) {
    const time = Date.parse(input.lockedUntil);
    if (Number.isNaN(time) || time <= Date.now()) return invalid();
    lockedUntil = new Date(time).toISOString();
  }

  try {
    const response = await adminUsersControllerLock(input.userId, { reason, lockedUntil });
    revalidateAdmin('/admin/users');
    return { ok: true, data: unwrap<AdminUserResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function unlockUserAction(
  userId: string,
): Promise<ActionResult<AdminUserResponseDto>> {
  if (!isId(userId)) return invalid();

  try {
    const response = await adminUsersControllerUnlock(userId);
    revalidateAdmin('/admin/users');
    return { ok: true, data: unwrap<AdminUserResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function deactivateUserAction(userId: string): Promise<ActionResult<{ id: string }>> {
  if (!isId(userId)) return invalid();

  try {
    await adminUsersControllerDeactivate(userId);
    revalidateAdmin('/admin/users');
    return { ok: true, data: { id: userId } };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function restoreUserAction(
  userId: string,
): Promise<ActionResult<AdminUserResponseDto>> {
  if (!isId(userId)) return invalid();

  try {
    const response = await adminUsersControllerRestore(userId);
    revalidateAdmin('/admin/users');
    return { ok: true, data: unwrap<AdminUserResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

/* ------------------------------------------------------------- categories */

export async function createCategoryAction(input: {
  name: LocalizedInput;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<ActionResult<AdminCategoryResponseDto>> {
  const name = cleanLocalized(input?.name, NAME_MAX);
  if (!name) return invalid();

  try {
    const response = await adminCategoriesControllerCreate({
      name,
      sortOrder: isInt(input.sortOrder, 0, 32767) ? input.sortOrder : undefined,
      isActive: typeof input.isActive === 'boolean' ? input.isActive : undefined,
    });
    revalidateAdmin('/admin/categories', '/admin/products');
    return { ok: true, data: unwrap<AdminCategoryResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateCategoryAction(input: {
  categoryId: string;
  name?: LocalizedInput;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<ActionResult<AdminCategoryResponseDto>> {
  if (!isId(input?.categoryId)) return invalid();
  const name = input.name === undefined ? undefined : cleanLocalized(input.name, NAME_MAX);
  if (input.name !== undefined && !name) return invalid();
  if (input.sortOrder !== undefined && !isInt(input.sortOrder, 0, 32767)) return invalid();
  if (input.isActive !== undefined && typeof input.isActive !== 'boolean') return invalid();

  try {
    const response = await adminCategoriesControllerUpdate(input.categoryId, {
      ...(name && { name }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
    revalidateAdmin('/admin/categories', '/admin/products');
    return { ok: true, data: unwrap<AdminCategoryResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function deleteCategoryAction(
  categoryId: string,
): Promise<ActionResult<{ id: string }>> {
  if (!isId(categoryId)) return invalid();

  try {
    await adminCategoriesControllerDelete(categoryId);
    revalidateAdmin('/admin/categories', '/admin/products');
    return { ok: true, data: { id: categoryId } };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function restoreCategoryAction(
  categoryId: string,
): Promise<ActionResult<AdminCategoryResponseDto>> {
  if (!isId(categoryId)) return invalid();

  try {
    const response = await adminCategoriesControllerRestore(categoryId);
    revalidateAdmin('/admin/categories', '/admin/products');
    return { ok: true, data: unwrap<AdminCategoryResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

/* --------------------------------------------------------------- toppings */

export async function createToppingAction(input: {
  name: LocalizedInput;
  priceVnd: number;
}): Promise<ActionResult<AdminToppingResponseDto>> {
  const name = cleanLocalized(input?.name, NAME_MAX);
  if (!name || !isInt(input?.priceVnd, 0, 10_000_000)) return invalid();

  try {
    const response = await adminToppingsControllerCreate({ name, priceVnd: input.priceVnd });
    revalidateAdmin('/admin/toppings', '/admin/products');
    return { ok: true, data: unwrap<AdminToppingResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateToppingAction(input: {
  toppingId: string;
  name?: LocalizedInput;
  priceVnd?: number;
  isAvailable?: boolean;
}): Promise<ActionResult<AdminToppingResponseDto>> {
  if (!isId(input?.toppingId)) return invalid();
  const name = input.name === undefined ? undefined : cleanLocalized(input.name, NAME_MAX);
  if (input.name !== undefined && !name) return invalid();
  if (input.priceVnd !== undefined && !isInt(input.priceVnd, 0, 10_000_000)) return invalid();
  if (input.isAvailable !== undefined && typeof input.isAvailable !== 'boolean') return invalid();
  if (name === undefined && input.priceVnd === undefined && input.isAvailable === undefined) {
    return invalid();
  }

  try {
    const response = await adminToppingsControllerUpdate(input.toppingId, {
      ...(name && { name }),
      ...(input.priceVnd !== undefined && { priceVnd: input.priceVnd }),
      ...(input.isAvailable !== undefined && { isAvailable: input.isAvailable }),
    });
    revalidateAdmin('/admin/toppings', '/admin/products');
    return { ok: true, data: unwrap<AdminToppingResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function deleteToppingAction(
  toppingId: string,
): Promise<ActionResult<{ id: string }>> {
  if (!isId(toppingId)) return invalid();

  try {
    await adminToppingsControllerDelete(toppingId);
    revalidateAdmin('/admin/toppings', '/admin/products');
    return { ok: true, data: { id: toppingId } };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function restoreToppingAction(
  toppingId: string,
): Promise<ActionResult<AdminToppingResponseDto>> {
  if (!isId(toppingId)) return invalid();

  try {
    const response = await adminToppingsControllerRestore(toppingId);
    revalidateAdmin('/admin/toppings', '/admin/products');
    return { ok: true, data: unwrap<AdminToppingResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

/* --------------------------------------------------------------- products */

type SizeInput = { size: 'S' | 'M' | 'L'; priceDeltaVnd: number };

function cleanSizes(value: unknown): SizeInput[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) return null;
  const sizes: SizeInput[] = [];
  for (const row of value) {
    if (typeof row !== 'object' || row === null) return null;
    const item = row as Record<string, unknown>;
    if (!SIZES.has(String(item.size)) || !isInt(item.priceDeltaVnd, 0, 10_000_000)) return null;
    if (sizes.some((size) => size.size === item.size)) return null;
    sizes.push({
      size: String(item.size) as SizeInput['size'],
      priceDeltaVnd: item.priceDeltaVnd,
    });
  }
  return sizes;
}

function cleanToppingIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.filter((id): id is string => typeof id === 'string' && id.length > 0);
  return ids.length === value.length && new Set(ids).size === ids.length ? ids : null;
}

export async function createProductAction(input: {
  categoryId: string;
  name: LocalizedInput;
  description?: LocalizedInput;
  basePriceVnd: number;
  sizes: SizeInput[];
  toppingIds: string[];
  stockQty?: number | null;
  sortOrder?: number;
}): Promise<ActionResult<AdminProductResponseDto>> {
  const name = cleanLocalized(input?.name, NAME_MAX);
  const description = cleanOptionalLocalized(input?.description, DESCRIPTION_MAX);
  const sizes = cleanSizes(input?.sizes);
  const toppingIds = cleanToppingIds(input?.toppingIds);
  if (
    !isId(input?.categoryId) ||
    !name ||
    !sizes ||
    !toppingIds ||
    !isInt(input?.basePriceVnd, 0, 10_000_000) ||
    (input.stockQty != null && !isInt(input.stockQty, 0, STOCK_MAX)) ||
    (input.sortOrder !== undefined && !isInt(input.sortOrder, 0, 32767))
  ) {
    return invalid();
  }

  try {
    const response = await adminProductsControllerCreate({
      categoryId: input.categoryId,
      name,
      ...(description && { description }),
      basePriceVnd: input.basePriceVnd,
      sizes,
      toppingIds,
      stockQty: input.stockQty ?? null,
      sortOrder: input.sortOrder,
    });
    revalidateAdmin('/admin/products', '/admin/categories', '/admin/toppings');
    return { ok: true, data: unwrap<AdminProductResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateProductAction(input: {
  productId: string;
  categoryId: string;
  name: LocalizedInput;
  description?: LocalizedInput | null;
  basePriceVnd: number;
  sizes: SizeInput[];
  toppingIds: string[];
  sortOrder?: number;
}): Promise<ActionResult<AdminProductResponseDto>> {
  const name = cleanLocalized(input?.name, NAME_MAX);
  const description = cleanOptionalLocalized(input?.description, DESCRIPTION_MAX);
  const sizes = cleanSizes(input?.sizes);
  const toppingIds = cleanToppingIds(input?.toppingIds);
  if (
    !isId(input?.productId) ||
    !isId(input?.categoryId) ||
    !name ||
    !sizes ||
    !toppingIds ||
    !isInt(input?.basePriceVnd, 0, 10_000_000) ||
    (input.sortOrder !== undefined && !isInt(input.sortOrder, 0, 32767))
  ) {
    return invalid();
  }

  try {
    await adminProductsControllerUpdate(input.productId, {
      categoryId: input.categoryId,
      name,
      description: description ?? null,
      basePriceVnd: input.basePriceVnd,
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    });
    await adminProductsControllerReplaceSizes(input.productId, { sizes });
    await adminProductsControllerReplaceToppings(input.productId, { toppingIds });
    const response = await adminProductsControllerGet(input.productId);
    revalidateAdmin('/admin/products', '/admin/categories', '/admin/toppings');
    return { ok: true, data: unwrap<AdminProductResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function getProductAction(
  productId: string,
): Promise<ActionResult<AdminProductResponseDto>> {
  if (!isId(productId)) return invalid();

  try {
    const response = await adminProductsControllerGet(productId);
    return { ok: true, data: unwrap<AdminProductResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function deleteProductAction(
  productId: string,
): Promise<ActionResult<{ id: string }>> {
  if (!isId(productId)) return invalid();

  try {
    await adminProductsControllerDelete(productId);
    revalidateAdmin('/admin/products', '/admin/categories', '/admin/toppings');
    return { ok: true, data: { id: productId } };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function restoreProductAction(
  productId: string,
): Promise<ActionResult<AdminProductResponseDto>> {
  if (!isId(productId)) return invalid();

  try {
    const response = await adminProductsControllerRestore(productId);
    revalidateAdmin('/admin/products', '/admin/categories', '/admin/toppings');
    return { ok: true, data: unwrap<AdminProductResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

/* ------------------------------------------------------------- promotions */

const PROMO_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

export async function createPromotionAction(input: {
  code: string;
  description?: string;
  discountType: string;
  discountValue: number;
  maxDiscountVnd?: number | null;
  minSubtotalVnd: number;
  startsAt: string;
  endsAt: string;
  maxUses?: number | null;
  perUserLimit?: number | null;
  isActive?: boolean;
}): Promise<ActionResult<PromotionResponseDto>> {
  const code = typeof input?.code === 'string' ? input.code.trim().toUpperCase() : '';
  const description = cleanOptionalText(input?.description, PROMO_DESCRIPTION_MAX_LENGTH);
  const startsAt = typeof input.startsAt === 'string' ? Date.parse(input.startsAt) : NaN;
  const endsAt = typeof input.endsAt === 'string' ? Date.parse(input.endsAt) : NaN;
  if (
    !PROMO_CODE_PATTERN.test(code) ||
    !DISCOUNT_TYPES.has(input.discountType) ||
    !isInt(input.discountValue, 1, 10_000_000) ||
    !isInt(input.minSubtotalVnd, 0, 10_000_000) ||
    Number.isNaN(startsAt) ||
    Number.isNaN(endsAt) ||
    endsAt <= startsAt ||
    (input.maxDiscountVnd != null && !isInt(input.maxDiscountVnd, 0, 10_000_000)) ||
    (input.maxUses != null && !isInt(input.maxUses, 0, 1_000_000)) ||
    (input.perUserLimit != null && !isInt(input.perUserLimit, 0, 1_000_000))
  ) {
    return invalid();
  }

  try {
    const response = await promotionsControllerCreate({
      code,
      ...(description != null && { description }),
      discountType: input.discountType as 'PERCENT' | 'FIXED',
      discountValue: input.discountValue,
      ...(input.maxDiscountVnd != null && { maxDiscountVnd: input.maxDiscountVnd }),
      minSubtotalVnd: input.minSubtotalVnd,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      ...(input.maxUses != null && { maxUses: input.maxUses }),
      ...(input.perUserLimit != null && { perUserLimit: input.perUserLimit }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
    revalidateAdmin('/admin/promotions');
    return { ok: true, data: unwrap<PromotionResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function getPromotionAction(
  promotionId: string,
): Promise<ActionResult<PromotionResponseDto>> {
  if (!isId(promotionId)) return invalid();

  try {
    const response = await promotionsControllerGet(promotionId);
    return { ok: true, data: unwrap<PromotionResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updatePromotionAction(input: {
  promotionId: string;
  description?: string;
  endsAt?: string;
  maxUses?: number | null;
  perUserLimit?: number | null;
  isActive?: boolean;
}): Promise<ActionResult<PromotionResponseDto>> {
  if (!isId(input?.promotionId)) return invalid();
  const description = cleanOptionalText(input.description, PROMO_DESCRIPTION_MAX_LENGTH);
  const endsAt = typeof input.endsAt === 'string' ? Date.parse(input.endsAt) : NaN;
  if (
    (input.description !== undefined && description === undefined) ||
    (input.endsAt !== undefined && Number.isNaN(endsAt)) ||
    (input.maxUses != null && !isInt(input.maxUses, 0, 1_000_000)) ||
    (input.perUserLimit != null && !isInt(input.perUserLimit, 0, 1_000_000)) ||
    (input.isActive !== undefined && typeof input.isActive !== 'boolean')
  ) {
    return invalid();
  }

  try {
    const response = await promotionsControllerUpdate(input.promotionId, {
      ...(description !== undefined && { description: description ?? undefined }),
      ...(description === null && { clearDescription: true }),
      ...(input.endsAt !== undefined && { endsAt: new Date(endsAt).toISOString() }),
      ...(input.maxUses !== undefined && { maxUses: input.maxUses ?? 0 }),
      ...(input.perUserLimit !== undefined && { perUserLimit: input.perUserLimit ?? 0 }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
    revalidateAdmin('/admin/promotions');
    return { ok: true, data: unwrap<PromotionResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function deletePromotionAction(
  promotionId: string,
): Promise<ActionResult<{ id: string }>> {
  if (!isId(promotionId)) return invalid();

  try {
    await promotionsControllerDelete(promotionId);
    revalidateAdmin('/admin/promotions');
    return { ok: true, data: { id: promotionId } };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function restorePromotionAction(
  promotionId: string,
): Promise<ActionResult<PromotionResponseDto>> {
  if (!isId(promotionId)) return invalid();

  try {
    const response = await promotionsControllerRestore(promotionId);
    revalidateAdmin('/admin/promotions');
    return { ok: true, data: unwrap<PromotionResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

/* ----------------------------------------------------------------- images */

function invalidImage(): ActionResult<never> {
  return { ok: false, code: 'IMAGE_INVALID', details: {} };
}

/** The gateway validates the bytes too; this is the fast, friendly check in the browser's request. */
export async function uploadProductImageAction(
  formData: FormData,
): Promise<ActionResult<{ imageUrl: string | null }>> {
  const productId = formData.get('productId');
  const file = formData.get('file');

  if (!isId(productId)) return invalid();
  if (!(file instanceof File) || file.size === 0) return invalidImage();
  if (!IMAGE_TYPES.has(file.type) || file.size > PRODUCT_IMAGE_MAX_BYTES) return invalidImage();

  try {
    const response = await adminProductsControllerSetImage(productId, { file });
    revalidatePath('/admin/products');
    return { ok: true, data: unwrap<SetProductImageResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function removeProductImageAction(
  productId: string,
): Promise<ActionResult<{ imageUrl: null }>> {
  if (!isId(productId)) return invalid();

  try {
    await adminProductsControllerClearImage(productId);
    revalidatePath('/admin/products');
    return { ok: true, data: { imageUrl: null } };
  } catch (error) {
    return actionFailure(error);
  }
}
