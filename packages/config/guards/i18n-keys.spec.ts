import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareStrings, ERRORS } from '@brewlite/contracts';

const LOCALES_DIR = join(__dirname, '..', '..', '..', 'apps', 'web', 'src', 'i18n', 'locales');

type Json = { [key: string]: Json | string };

/** `a.b_other` → `a.b`; `_one`/`_other` are the plural forms, which differ per language. */
function flatKeys(node: Json, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path.replace(/_(one|other)$/, '')] : flatKeys(value, path);
  });
}

function load(locale: string): Map<string, Set<string>> {
  const dir = join(LOCALES_DIR, locale);
  const namespaces = new Map<string, Set<string>>();
  if (!existsSync(dir)) return namespaces;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const json = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Json;
    namespaces.set(file.replace(/\.json$/, ''), new Set(flatKeys(json)));
  }
  return namespaces;
}

describe('i18n-keys', () => {
  const en = load('en');
  const vi = load('vi');

  it('has the same namespaces in en and vi', () => {
    expect([...vi.keys()].sort(compareStrings)).toEqual([...en.keys()].sort(compareStrings));
  });

  it('has the same keys in every namespace (plural suffixes normalised)', () => {
    for (const [ns, keys] of en) {
      expect([...(vi.get(ns) ?? [])].sort(compareStrings), `${ns}: vi`).toEqual(
        [...keys].sort(compareStrings),
      );
    }
  });

  it('has an errors key for every code in ERRORS, in both languages', () => {
    for (const locale of [en, vi]) {
      const errors = locale.get('errors') ?? new Set<string>();
      const missing = Object.keys(ERRORS).filter((code) => !errors.has(code));
      expect(missing).toEqual([]);
    }
  });

  it('has errors:UNKNOWN, the fallback', () => {
    expect(en.get('errors')?.has('UNKNOWN')).toBe(true);
  });
});
