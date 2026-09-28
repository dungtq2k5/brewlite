import { z } from 'zod';
import { zText } from './text.js';

/** A name or description entered in both languages (ADR 0031). */
export interface LocalizedText {
  en: string;
  vi: string;
}

/** Both keys required — a response never omits a language. */
export const zLocalizedTextResponse = z.object({
  en: z.string(),
  vi: z.string(),
});

/**
 * The request side: both languages required (ADR 0031, conventions §11.6), each trimmed,
 * NFC-normalised and bounded by `max` — never two loose string fields.
 */
export function zLocalizedText(max: number) {
  return z
    .object({
      en: zText(max),
      vi: zText(max),
    })
    .strict();
}
