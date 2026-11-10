import type { LocalizedText } from '@brewlite/contracts';

/** What a pair of English / Vietnamese fields can be wrong with — a key for the language's error line. */
export type PairIssue =
  | { language: 'en' | 'vi'; kind: 'missing' } // the other one is filled
  | { language: 'en' | 'vi'; kind: 'tooLong'; max: number };

/**
 * The pair rules of `BilingualField`, before anything is sent: both filled, or — for an optional pair —
 * both empty. A value is judged trimmed. A required pair with one side empty names that side; an
 * optional pair with one side filled names the empty side.
 */
export function checkPair(
  value: { en: string; vi: string },
  { required, max }: { required: boolean; max: number },
): PairIssue[] {
  const en = value.en.trim();
  const vi = value.vi.trim();
  const issues: PairIssue[] = [];
  if (en.length > max) issues.push({ language: 'en', kind: 'tooLong', max });
  if (vi.length > max) issues.push({ language: 'vi', kind: 'tooLong', max });
  if (required || en !== '' || vi !== '') {
    if (en === '') issues.push({ language: 'en', kind: 'missing' });
    if (vi === '') issues.push({ language: 'vi', kind: 'missing' });
  }
  return issues;
}

/** The pair as the API takes it, trimmed; `null` for an optional pair left empty. */
export function toLocalized(value: { en: string; vi: string }): LocalizedText | null {
  const en = value.en.trim();
  const vi = value.vi.trim();
  return en === '' && vi === '' ? null : { en, vi };
}
