import type { TFunction } from 'i18next';
import { formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';

/** *15% off, up to ₫20,000* / *₫15,000 off* — what a promotion gives, in the viewer's words. */
export function discountWords(
  t: TFunction,
  locale: Locale,
  p: { discountType: string; discountValue: number; maxDiscountVnd: number | null },
): string {
  if (p.discountType === 'FIXED') {
    return t('promo.fixed', { amount: formatVnd(p.discountValue, locale) });
  }
  return p.maxDiscountVnd
    ? t('promo.percentCapped', { value: p.discountValue, cap: formatVnd(p.maxDiscountVnd, locale) })
    : t('promo.percent', { value: p.discountValue });
}
