import type { TagTone } from '@/components/vellum/Tag';
import { formatDateTime, formatVnd } from '@/i18n/format';

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

export function formatMoment(value: string | null | undefined): string {
  if (!value) return '—';
  const time = Date.parse(value);
  if (Number.isNaN(time)) return '—';
  return formatDateTime(value, 'vi');
}

export function formatDay(value: string | null | undefined): string {
  if (!value) return '—';
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(time);
}

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: 'Khách hàng',
  STAFF: 'Nhân viên',
  ADMIN: 'Quản trị',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
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
): string {
  if (discountType === 'PERCENT') {
    const cap = maxDiscountVnd === null ? '' : `, tối đa ${formatVnd(maxDiscountVnd, 'vi')}`;
    return `${discountValue}%${cap}`;
  }
  return `−${formatVnd(discountValue, 'vi')}`;
}

export function promotionState(row: { isActive: boolean; startsAt: string; endsAt: string }): {
  label: string;
  tone: TagTone;
} {
  const now = Date.now();
  if (Date.parse(row.endsAt) < now) return { label: 'Hết hạn', tone: 'muted' };
  if (Date.parse(row.startsAt) > now) return { label: 'Chưa bắt đầu', tone: 'muted' };
  return row.isActive
    ? { label: 'Đang chạy', tone: 'success' }
    : { label: 'Tạm dừng', tone: 'warning' };
}
