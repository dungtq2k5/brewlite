import { z } from 'zod';

/**
 * Small enums that exist only inside an error's `details` — not columns, so they are not
 * in `enums.ts` and the rdm guard ignores them. The web app renders them through
 * `t('errors:<CODE>', details)`.
 */
export const zResourceKind = z.enum([
  'USER',
  'CATEGORY',
  'PRODUCT',
  'TOPPING',
  'ORDER',
  'PROMOTION',
  'PAYMENT',
]);
export type ResourceKind = z.infer<typeof zResourceKind>;

export const zPromoInvalidReason = z.enum([
  'NOT_FOUND',
  'INACTIVE',
  'NOT_STARTED',
  'EXPIRED',
  'MIN_SUBTOTAL',
  'EXHAUSTED',
  'PER_USER_LIMIT',
]);
export type PromoInvalidReason = z.infer<typeof zPromoInvalidReason>;

export const zOptionInvalidReason = z.enum(['SIZE', 'TOPPING', 'TOO_MANY_TOPPINGS']);
export type OptionInvalidReason = z.infer<typeof zOptionInvalidReason>;

export const zFirebaseTokenInvalidReason = z.enum(['INVALID', 'PROVIDER', 'EMAIL_UNVERIFIED']);
export type FirebaseTokenInvalidReason = z.infer<typeof zFirebaseTokenInvalidReason>;

export const zImageInvalidReason = z.enum(['TYPE', 'SIZE']);
export type ImageInvalidReason = z.infer<typeof zImageInvalidReason>;
