import { localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';

/** *Cà phê sữa đá ×2, Croissant* — names in the viewer's language, `×N` only when more than one. */
export function itemsSummary(
  lines: readonly { productName: { en: string; vi: string }; qty: number }[],
  locale: Locale,
): string {
  return lines
    .map((l) => `${localized(l.productName, locale)}${l.qty > 1 ? ` ×${l.qty}` : ''}`)
    .join(', ');
}
