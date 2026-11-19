import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES_DIR = join(__dirname, '..', '..', '..', 'apps', 'web', 'src', 'i18n', 'locales');

type Json = { [key: string]: Json | string };

/** Every value with a straight `'` or `"`, as `key: value` — copy uses `’ “ ”`. */
function straightQuotes(node: Json, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value !== 'string') return straightQuotes(value, path);
    return /['"]/.test(value) ? [`${path}: ${value}`] : [];
  });
}

describe('i18n-typography', () => {
  it('finds a straight quote', () => {
    expect(straightQuotes({ a: { b: "isn't" }, c: 'isn’t', d: 'say "hi"' })).toEqual([
      "a.b: isn't",
      'd: say "hi"',
    ]);
  });

  for (const locale of readdirSync(LOCALES_DIR)) {
    it(`${locale}: no straight quotes in any value`, () => {
      const dir = join(LOCALES_DIR, locale);
      const found = readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .flatMap((f) =>
          straightQuotes(JSON.parse(readFileSync(join(dir, f), 'utf8')) as Json).map(
            (hit) => `${f.replace(/\.json$/, '')}:${hit}`,
          ),
        );
      expect(found).toEqual([]);
    });
  }
});
