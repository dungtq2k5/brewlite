import { z } from 'zod';

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
