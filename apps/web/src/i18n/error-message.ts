import type { TFunction } from 'i18next';
import { formatDateTime, formatVnd } from './format';
import type { Locale } from './settings';

/**
 * The words for an API error: `errors:<CODE>` with the error's `details` interpolated.
 * A code missing from the namespace shows `errors:UNKNOWN`, never the raw code (architecture §4.7).
 * Three codes need their details shaped first: a lock instant becomes a clock time (or the
 * `indefinite` variant), a retry delay in seconds becomes a whole-minute `count` (plural forms), and a Firebase
 * failure picks its variant from `reason`.
 */
export function errorMessage(
  t: TFunction,
  locale: Locale,
  code: string,
  details?: unknown,
): string {
  const d = (typeof details === 'object' && details !== null ? details : {}) as Record<
    string,
    unknown
  >;
  const options: Record<string, unknown> = { ...d };

  if (code === 'ACCOUNT_LOCKED') {
    if (typeof d.lockedUntil === 'string') {
      options.lockedUntil = formatDateTime(d.lockedUntil, locale);
    } else {
      options.context = 'indefinite';
    }
  }
  if (code === 'RATE_LIMITED' && typeof d.retryAfterSeconds === 'number') {
    options.count = Math.max(1, Math.ceil(d.retryAfterSeconds / 60));
  }
  if (code === 'FIREBASE_TOKEN_INVALID' && typeof d.reason === 'string') {
    options.context = d.reason;
  }

  for (const field of ['minimumVnd', 'maximumVnd'] as const) {
    if (typeof d[field] === 'number' || typeof d[field] === 'string') {
      options[field] = formatVnd(d[field], locale);
    }
  }

  const key = `errors:${code}`;
  return t(key, { ...options, defaultValue: t('errors:UNKNOWN') });
}
