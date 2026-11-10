/**
 * Every admin list keeps its state in the URL (`q`, filters, `deleted`, `sort`, `page`), so a
 * reload, the back button and a shared link all hold it. These read `searchParams` with the API's
 * own allowlists: an unknown sort, filter value or page falls back to the default — never a `400`.
 */
export type RawParams = Record<string, string | string[] | undefined>;

export const ADMIN_PAGE_SIZE = 20;

/** The first value of a parameter, empty string when missing. */
export function firstParam(raw: RawParams, key: string): string {
  const value = raw[key];
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export function readPage(raw: RawParams): number {
  const n = Number(firstParam(raw, 'page'));
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

/** A value from a fixed list (a sort, a role…), or `fallback` when the URL says anything else. */
export function readChoice<T extends string>(
  raw: RawParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = firstParam(raw, key);
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Same, with no default: `undefined` for an absent or unknown value (a filter that is simply off). */
export function readOptionalChoice<T extends string>(
  raw: RawParams,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = firstParam(raw, key);
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** `?deleted=true` — anything else is off. */
export const readFlag = (raw: RawParams, key: string): boolean => firstParam(raw, key) === 'true';

/** A search term, trimmed and bounded — the API refuses nothing, but the URL should stay sane. */
export const readSearch = (raw: RawParams, key = 'q'): string =>
  firstParam(raw, key).trim().slice(0, 100);

/**
 * The address for a change of filters: `patch` over `current`, empty and default values dropped, and
 * back to page 1 unless the patch itself says a page. `defaults` are values that need no parameter.
 */
export function hrefWith(
  path: string,
  current: Record<string, string>,
  patch: Record<string, string | undefined>,
  defaults: Record<string, string> = {},
): string {
  const next: Record<string, string> = { ...current };
  if (!('page' in patch)) delete next.page;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '' || value === defaults[key]) delete next[key];
    else next[key] = value;
  }
  const query = new URLSearchParams(next).toString();
  return query ? `${path}?${query}` : path;
}

/** *21–40 of 132* — null when there is nothing to show. */
export function pageRange(page: number, pageSize: number, total: number) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  return { from: Math.min(from, total), to: Math.min(page * pageSize, total), total };
}

export const pageCount = (pageSize: number, total: number) =>
  Math.max(1, Math.ceil(total / pageSize));

/** The page buttons of a list: first, last and the current ±1, with `null` standing for a gap (…). */
export function pageWindow(page: number, last: number): (number | null)[] {
  const wanted = new Set([1, last, page - 1, page, page + 1].filter((n) => n >= 1 && n <= last));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const n of sorted) {
    const before = out.at(-1);
    if (typeof before === 'number' && n - before > 1)
      out.push(n - before === 2 ? before + 1 : null);
    out.push(n);
  }
  return out;
}
