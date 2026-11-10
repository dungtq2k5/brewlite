import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// tokens.json (the Designer's DTCG export) → the DaisyUI theme. One group maps to one
// variable prefix; a group or key this file does not know throws, so a new token fails the
// build instead of silently vanishing.
const PREFIX = { color: '--color-', radius: '--radius-', size: '--size-' };
const EFFECTS = new Set(['border', 'depth', 'noise']);
const KNOWN = {
  radius: new Set(['selector', 'field', 'box']),
  size: new Set(['selector', 'field']),
};

export function generateTheme(tokens) {
  const lines = [];
  for (const [group, entries] of Object.entries(tokens)) {
    for (const [name, token] of Object.entries(entries)) {
      const value = token.$value;
      if (group === 'font') {
        if (name !== 'sans') throw new Error(`unknown font token "${name}"`);
        continue; // the font is next/font's job (app.css), not a theme variable
      }
      if (group === 'effect') {
        if (!EFFECTS.has(name)) throw new Error(`unknown effect token "${name}"`);
        lines.push(`  --${name}: ${value};`);
        continue;
      }
      if (!(group in PREFIX)) throw new Error(`unknown token group "${group}"`);
      if (KNOWN[group] && !KNOWN[group].has(name)) {
        throw new Error(`unknown ${group} token "${name}"`);
      }
      lines.push(`  ${PREFIX[group]}${name}: ${value};`);
    }
  }
  return [
    '/* theme.css — generated from tokens.json by scripts/generate-theme.mjs; do not edit */',
    '@plugin "daisyui/theme" {',
    '  name: "brewlite";',
    '  default: true;',
    '  color-scheme: light;',
    ...lines,
    '}',
    '',
  ].join('\n');
}

/**
 * The theme exactly as Prettier would format it, so a formatter (format-on-save, a hand-run
 * `prettier --write`) can never make the committed file drift from what CI regenerates.
 */
export async function formatTheme(css, file) {
  const prettier = await import('prettier');
  const options = (await prettier.resolveConfig(file)) ?? {};
  return prettier.format(css, { ...options, filepath: file });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../src/styles/', import.meta.url);
  const tokens = JSON.parse(readFileSync(new URL('tokens.json', root), 'utf8'));
  const file = fileURLToPath(new URL('theme.css', root));
  writeFileSync(file, await formatTheme(generateTheme(tokens), file));
}
