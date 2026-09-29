#!/usr/bin/env node
// Prisma 7.10's client generator emits relative imports/exports with a literal `.ts`
// extension for this schema's shape (catalog's identical generator config emits `.js`
// for its own schema — a generator inconsistency, not a config difference). SWC
// transpiles each file's syntax without rewriting import specifiers, so the compiled
// `dist/generated/prisma/**/*.js` keeps the `.ts` extension and `require()` fails at
// runtime. Rewritten here, right after `prisma generate`, before SWC ever sees it.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../generated/prisma');

function tsFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsFiles(path);
    return name.endsWith('.ts') ? [path] : [];
  });
}

for (const file of tsFiles(root)) {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(/(from\s+["']\.[^"']*)\.ts(["'])/g, '$1.js$2');
  if (after !== before) writeFileSync(file, after);
}
