import { z } from 'zod';

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
