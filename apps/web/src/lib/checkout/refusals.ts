import { MIN_PAYABLE_VND } from '@brewlite/contracts';
import type { CartLine } from '@/lib/cart/cart';
import type { UnavailableReason } from '@/lib/cart/unavailable';

export type PromoReason =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'MIN_SUBTOTAL'
  | 'EXHAUSTED'
  | 'PER_USER_LIMIT';

/** What a refused quote or order means for the screen — one at a time, as the API answers (§3.3). */
export type Refusal =
  | { kind: 'products'; lineKeys: string[] }
  | { kind: 'option'; lineKey: string; reason: 'SIZE' | 'TOPPING' | 'TOO_MANY_TOPPINGS' }
  | { kind: 'stock'; available: ReadonlyMap<string, number> }
  | { kind: 'promo'; reason: PromoReason; minSubtotalVnd?: number }
  | { kind: 'total'; side: 'low' | 'high'; limitVnd: number }
  | { kind: 'failed'; code: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/**
 * Maps the API's refusal to the cart's lines. The lines are the cart's, **in cart order** — the
 * quote is asked with them in that order, so `OPTION_INVALID.details.lineIndex` is a cart index.
 */
export function mapRefusal(code: string, details: unknown, lines: readonly CartLine[]): Refusal {
  const d = isRecord(details) ? details : {};
  switch (code) {
    case 'PRODUCT_UNAVAILABLE': {
      const ids = Array.isArray(d.productIds) ? (d.productIds as string[]) : [];
      return {
        kind: 'products',
        lineKeys: lines.filter((l) => ids.includes(l.productId)).map((l) => l.key),
      };
    }
    case 'OPTION_INVALID': {
      const line = typeof d.lineIndex === 'number' ? lines[d.lineIndex] : undefined;
      const reason = d.reason;
      if (line && (reason === 'SIZE' || reason === 'TOPPING' || reason === 'TOO_MANY_TOPPINGS')) {
        return { kind: 'option', lineKey: line.key, reason };
      }
      return { kind: 'failed', code };
    }
    case 'OUT_OF_STOCK': {
      const products = Array.isArray(d.products)
        ? (d.products as { productId: string; available: number }[])
        : [];
      const available = new Map<string, number>();
      for (const p of products) {
        for (const line of lines)
          if (line.productId === p.productId) available.set(line.key, p.available);
      }
      return available.size > 0 ? { kind: 'stock', available } : { kind: 'failed', code };
    }
    case 'PROMO_CODE_INVALID':
      return {
        kind: 'promo',
        reason: d.reason as PromoReason,
        ...(typeof d.minSubtotalVnd === 'number' && { minSubtotalVnd: d.minSubtotalVnd }),
      };
    case 'ORDER_TOTAL_TOO_LOW':
      return {
        kind: 'total',
        side: 'low',
        limitVnd: typeof d.minimumVnd === 'number' ? d.minimumVnd : MIN_PAYABLE_VND,
      };
    case 'ORDER_TOTAL_TOO_HIGH':
      return {
        kind: 'total',
        side: 'high',
        limitVnd: typeof d.maximumVnd === 'number' ? d.maximumVnd : 0,
      };
    default:
      return { kind: 'failed', code };
  }
}

/** The *unavailable* variant's reason for a marked line, when the refusal marks it that way. */
export function unavailableFor(
  refusal: Refusal | null,
  line: CartLine,
): UnavailableReason | undefined {
  if (!refusal) return undefined;
  if (refusal.kind === 'products' && refusal.lineKeys.includes(line.key)) {
    return { code: 'PRODUCT_UNAVAILABLE' };
  }
  if (refusal.kind === 'option' && refusal.lineKey === line.key) {
    return { code: 'OPTION_INVALID', reason: refusal.reason };
  }
  return undefined;
}

/** Stock left for a line (`OUT_OF_STOCK` keeps the stepper and adds a line under it). */
export const stockLeftFor = (refusal: Refusal | null, line: CartLine): number | undefined =>
  refusal?.kind === 'stock' ? refusal.available.get(line.key) : undefined;

/** The wire's items, the cart's lines **in cart order**. */
export function toQuoteItems(lines: readonly CartLine[]) {
  return lines.map((l) => ({
    productId: l.productId,
    size: l.size,
    toppingIds: l.toppings.map((t) => t.id),
    qty: l.quantity,
  }));
}
