import { createHash } from 'node:crypto';
import { compareStrings } from '@brewlite/contracts';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort(compareStrings)) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined) continue;
      sorted[key] = canonicalize(v);
    }
    return sorted;
  }
  return value;
}

/**
 * SHA-256 hex of canonical JSON: object keys sorted recursively, arrays kept in order,
 * `undefined`-valued keys dropped — two bodies that mean the same thing hash the same
 * (rdm-spec §1.7, ADR 0020). The caller passes the already-parsed, already-normalized
 * request, not the raw body.
 */
export function contentHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}
