#!/usr/bin/env node
// Prisma 7.10's client generator emits relative imports/exports with a literal `.ts`
// extension for some schema shapes (not others — a generator inconsistency, not a
// config difference). SWC transpiles each file's syntax without rewriting import
// specifiers, so the compiled `dist/generated/prisma/**/*.js` keeps the `.ts` extension
// and `require()` fails at runtime. Rewritten here, right after `prisma generate`,
// before SWC ever sees it.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const serviceDir = process.argv[2];
if (!serviceDir) {
  console.error('usage: brewlite-fix-prisma-imports <service-directory>');
  process.exit(1);
}

const root = resolve(serviceDir, 'generated/prisma');

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
