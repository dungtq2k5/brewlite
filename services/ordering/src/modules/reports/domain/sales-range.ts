import { zBusinessDayRange, zUuidV7 } from '@brewlite/contracts';
import { toJsonPointer } from '../../admin-orders/domain/list-orders-query.js';

/** The report's input: real days, `from` ≤ `to`, at most 93 days. Issues in the wire's `{ path, code }` shape. */
export function parseSalesRange(raw: { from: string; to: string }) {
  const result = zBusinessDayRange.safeParse(raw);
  if (result.success) return { ok: true as const, range: result.data };
  return {
    ok: false as const,
    issues: result.error.issues.map((i) => ({ path: toJsonPointer(i.path), code: i.code })),
  };
}

/** The staff-stats input: the same range, for one user. */
export function parseStaffStats(raw: { userId: string; from: string; to: string }) {
  const range = parseSalesRange({ from: raw.from, to: raw.to });
  const user = zUuidV7.safeParse(raw.userId);
  const issues = [
    ...(range.ok ? [] : range.issues),
    ...(user.success ? [] : [{ path: '/userId', code: 'invalid_format' }]),
  ];
  if (issues.length > 0 || !range.ok) return { ok: false as const, issues };
  return { ok: true as const, userId: raw.userId, range: range.range };
}
