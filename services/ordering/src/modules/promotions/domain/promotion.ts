import { DiscountType, MIN_PAYABLE_VND, type PromoInvalidReason } from '@brewlite/contracts';

export interface PromotionRule {
  discountType: DiscountType;
  discountValue: number;
  maxDiscountVnd: number | null;
  minSubtotalVnd: number;
  startsAt: Date;
  endsAt: Date;
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number | null;
  isActive: boolean;
}

export interface PromotionContext {
  subtotalVnd: number;
  now: Date;
  usesByThisCustomer: number;
}

/** The seven refusal reasons, first failure wins (product-overview §6.5). `p: null` is a deleted or unknown code. */
export function validatePromotion(
  p: PromotionRule | null,
  ctx: PromotionContext,
): PromoInvalidReason | null {
  if (!p) return 'NOT_FOUND';
  if (!p.isActive) return 'INACTIVE';
  if (ctx.now < p.startsAt) return 'NOT_STARTED';
  if (ctx.now >= p.endsAt) return 'EXPIRED';
  if (ctx.subtotalVnd < p.minSubtotalVnd) return 'MIN_SUBTOTAL';
  if (p.maxUses !== null && p.usedCount >= p.maxUses) return 'EXHAUSTED';
  if (p.perUserLimit !== null && ctx.usesByThisCustomer >= p.perUserLimit) return 'PER_USER_LIMIT';
  return null;
}

/**
 * The discount, in đồng. Percent rounds down (conventions §10.1). Capped so the total
 * never drops below `MIN_PAYABLE_VND` — the caller must have already refused a subtotal
 * below that minimum, or this clamp would make the discount negative.
 */
export function applyPromotion(p: PromotionRule, subtotalVnd: number): number {
  let discount =
    p.discountType === DiscountType.PERCENT
      ? Math.floor((subtotalVnd * p.discountValue) / 100)
      : p.discountValue;
  if (p.discountType === DiscountType.PERCENT && p.maxDiscountVnd !== null) {
    discount = Math.min(discount, p.maxDiscountVnd);
  }
  return Math.min(discount, subtotalVnd - MIN_PAYABLE_VND);
}
