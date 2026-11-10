import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatTheme, generateTheme } from './generate-theme.mjs';

const t = (v: unknown) => ({ $value: v });

describe('generateTheme', () => {
  it('maps a token to its variable', () => {
    const css = generateTheme({
      color: { primary: t('#6B3A1F') },
      radius: { box: t('1rem') },
      size: { field: t('0.275rem') },
      effect: { depth: t(1) },
      font: { sans: t(['Be Vietnam Pro', 'sans-serif']) },
    });
    expect(css).toContain('--color-primary: #6B3A1F;');
    expect(css).toContain('--radius-box: 1rem;');
    expect(css).toContain('--size-field: 0.275rem;');
    expect(css).toContain('--depth: 1;');
    expect(css).not.toContain('Be Vietnam');
  });
  it.each([
    { colour: { primary: t('#fff') } },
    { radius: { huge: t('9rem') } },
    { effect: { glow: t(1) } },
    { font: { serif: t('x') } },
  ])('throws on an unknown token %j', (tokens) => {
    expect(() => generateTheme(tokens)).toThrow(/unknown/);
  });

  it("writes Prettier's formatting, so formatting the file again changes nothing", async () => {
    const file = fileURLToPath(new URL('../src/styles/theme.css', import.meta.url));
    const tokens = JSON.parse(
      readFileSync(new URL('../src/styles/tokens.json', import.meta.url), 'utf8'),
    ) as Record<string, Record<string, { $value: string }>>;
    const once = await formatTheme(generateTheme(tokens), file);
    expect(await formatTheme(once, file)).toBe(once);
  });
});
