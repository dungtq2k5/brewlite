import type { TagTone } from '@/components/vellum/Tag';
import { formatDateTime, formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';

/**
 * Orval types a nullable response column as `T[]`; the gateway sends `T | null`.
 * These readers accept both shapes so a page never dereferences a null array.
 */
export function nullableText(value: string | readonly string[] | null | undefined): string | null {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null;
  return typeof value === 'string' ? value : null;
}

export function nullableNumber(
  value: number | readonly number[] | null | undefined,
): number | null {
  if (Array.isArray(value)) return typeof value[0] === 'number' ? value[0] : null;
  return typeof value === 'number' ? value : null;
}

export function formatMoment(value: string | null | undefined, locale: Locale = 'vi'): string {
  if (!value) return '—';
  const time = Date.parse(value);
  if (Number.isNaN(time)) return '—';
  return formatDateTime(value, locale);
}

export function formatDay(value: string | null | undefined, locale: Locale = 'vi'): string {
  if (!value) return '—';
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(time);
}

const ROLE_LABELS: Record<Locale, Record<string, string>> = {
  vi: { CUSTOMER: 'Khách hàng', STAFF: 'Nhân viên', ADMIN: 'Quản trị' },
  en: { CUSTOMER: 'Customer', STAFF: 'Staff', ADMIN: 'Admin' },
};

export function roleLabel(role: string, locale: Locale = 'vi'): string {
  return ROLE_LABELS[locale][role] ?? role;
}

export function roleTone(role: string): TagTone | undefined {
  if (role === 'ADMIN') return 'accent';
  if (role === 'STAFF') return undefined;
  return 'muted';
}

export function discountLabel(
  discountType: string,
  discountValue: number,
  maxDiscountVnd: number | null,
  locale: Locale = 'vi',
): string {
  if (discountType === 'PERCENT') {
    const cap =
      maxDiscountVnd === null
        ? ''
        : locale === 'vi'
          ? `, tối đa ${formatVnd(maxDiscountVnd, locale)}`
          : `, up to ${formatVnd(maxDiscountVnd, locale)}`;
    return `${discountValue}%${cap}`;
  }
  return `−${formatVnd(discountValue, locale)}`;
}

export function promotionState(
  row: { isActive: boolean; startsAt: string; endsAt: string },
  locale: Locale = 'vi',
): {
  label: string;
  tone: TagTone;
} {
  const now = Date.now();
  const isVi = locale === 'vi';
  if (Date.parse(row.endsAt) < now) {
    return { label: isVi ? 'Hết hạn' : 'Expired', tone: 'muted' };
  }
  if (Date.parse(row.startsAt) > now) {
    return { label: isVi ? 'Chưa bắt đầu' : 'Scheduled', tone: 'muted' };
  }
  return row.isActive
    ? { label: isVi ? 'Đang chạy' : 'Active', tone: 'success' }
    : { label: isVi ? 'Tạm dừng' : 'Paused', tone: 'warning' };
}
