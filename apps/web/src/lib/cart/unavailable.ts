import type { TFunction } from 'i18next';
import { localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import type { CartLine } from './cart';

/**
 * Why the server refused a line (checkout shows these; nothing in the cart sets one). The names
 * mirror the API's errors: `PRODUCT_UNAVAILABLE`, `OPTION_INVALID` with its `reason`, `OUT_OF_STOCK`.
 */
export type UnavailableReason =
  | { code: 'PRODUCT_UNAVAILABLE' }
  | {
      code: 'OPTION_INVALID';
      reason: 'SIZE' | 'TOPPING' | 'TOO_MANY_TOPPINGS';
      toppingName?: string;
    }
  | { code: 'OUT_OF_STOCK'; available: number };

/** The handoff's words for each reason; `t` must have the `cart` namespace loaded. */
export function unavailableText(
  t: TFunction,
  reason: UnavailableReason,
  line: Pick<CartLine, 'size' | 'toppings'>,
  locale: Locale,
): string {
  switch (reason.code) {
    case 'PRODUCT_UNAVAILABLE':
      return t('cart:unavailable.PRODUCT_UNAVAILABLE');
    case 'OUT_OF_STOCK':
      return t('cart:unavailable.OUT_OF_STOCK', { available: reason.available });
    case 'OPTION_INVALID':
      if (reason.reason === 'SIZE') {
        return t('cart:unavailable.OPTION_INVALID_SIZE', { size: line.size });
      }
      if (reason.reason === 'TOO_MANY_TOPPINGS') {
        return t('cart:unavailable.OPTION_INVALID_TOO_MANY_TOPPINGS');
      }
      // The API names no topping. Name one only when it can only be that one — the reason's own
      // `toppingName`, or the line's single topping; otherwise say so without a name.
      if (reason.toppingName !== undefined || line.toppings.length === 1) {
        return t('cart:unavailable.OPTION_INVALID_TOPPING', {
          topping: reason.toppingName ?? localized(line.toppings[0]!.name, locale),
        });
      }
      return t('cart:unavailable.OPTION_INVALID_TOPPING_UNNAMED');
  }
}
