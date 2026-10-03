import { z } from 'zod';
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_BYTES, PASSWORD_MIN_BYTES } from './constants.js';

/** `s.normalize('NFC').trim()` (rdm-spec §2.3) — two encodings of "Cà phê sữa" compare equal. */
export function normalizeText(s: string): string {
  return s.normalize('NFC').trim();
}

/**
 * Normalises before measuring, then bounds. ⚠️ Length is measured in UTF-16 code units;
 * Postgres `VARCHAR(n)` counts characters — an emoji is 2 here and 1 there, so the edge
 * is *stricter* than the column, the safe direction. Every Vietnamese letter is one code
 * unit after NFC.
 */
export function zText(max: number, { min = 1 }: { min?: number } = {}) {
  return z.string().transform(normalizeText).pipe(z.string().min(min).max(max));
}

/** UTF-16 code-unit order, the same as Postgres `COLLATE "C"` — never `localeCompare`. */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `s.trim().toLowerCase()` (rdm-spec §2.3) — `users_email_lower_ck` refuses anything else. */
export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

export const zEmail = z.string().transform(normalizeEmail).pipe(z.email().max(EMAIL_MAX_LENGTH));

/**
 * A password's **UTF-8 byte length**, not its character count — bcrypt (and the
 * `password_hash` column) count bytes. Measured with `TextEncoder`, not `Buffer`:
 * contracts is client-safe. Never normalised or trimmed — a password is bytes, not text.
 */
export const zPassword = z.string().refine(
  (s) => {
    const bytes = new TextEncoder().encode(s).length;
    return bytes >= PASSWORD_MIN_BYTES && bytes <= PASSWORD_MAX_BYTES;
  },
  { message: `password must be ${PASSWORD_MIN_BYTES}-${PASSWORD_MAX_BYTES} bytes` },
);
