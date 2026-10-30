import { zBusinessDayRange } from '@brewlite/contracts';
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
