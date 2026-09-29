import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { gitFiles, readRepoFile } from './lib/corpus.js';

interface Violation {
  file: string;
  line: number;
  message: string;
}

const KNOWN_ROLE_PATTERNS = [
  /\.module\.ts$/,
  /-grpc\.controller\.ts$/,
  /\.controller\.ts$/,
  /\.service\.ts$/,
  /\.consumer\.ts$/,
  /\.mapper\.ts$/,
  /\.job\.ts$/,
  /-grpc\.client\.ts$/,
  /\/dto\/.*\.dto\.ts$/,
  /\/domain\/.*\.ts$/,
  /\.spec\.ts$/,
];

function modulesFiles(files: string[]): string[] {
  return files.filter((f) => /^services\/[^/]+\/src\/modules\//.test(f) && f.endsWith('.ts'));
}

function check(files: string[]): Violation[] {
  const violations: Violation[] = [];
  for (const file of modulesFiles(files)) {
    if (file.endsWith('.repository.ts')) {
      violations.push({ file, line: 1, message: 'no repository layer (ADR 0008)' });
      continue;
    }
    if (!KNOWN_ROLE_PATTERNS.some((pattern) => pattern.test(file))) {
      violations.push({ file, line: 1, message: 'matches no known module-file role' });
      continue;
    }
    if (/\/domain\//.test(file)) {
      const content = readRepoFile(file);
      for (const [i, line] of content.split('\n').entries()) {
        // A type-only `generated/prisma` import is the sanctioned pattern (the
        // `**/domain/*.ts` ESLint block allows it with `allowTypeImports: true`,
        // conventions §2.1) — only a runtime import, or any `@nestjs/` import
        // (type or not — domain stays framework-free), is a violation here.
        const isTypeOnlyPrismaImport =
          /generated\/prisma/.test(line) && /^\s*import\s+type\b/.test(line);
        if (
          /from ['"]@nestjs\//.test(line) ||
          (/generated\/prisma/.test(line) && !isTypeOnlyPrismaImport)
        ) {
          violations.push({
            file,
            line: i + 1,
            message:
              'domain/*.ts imports @nestjs/ or the runtime generated/prisma client (conventions §2.1)',
          });
        }
      }
    }
  }
  return violations;
}

const REPO_ROOT = join(process.cwd(), '..', '..');
const written: string[] = [];

afterEach(() => {
  for (const file of written.splice(0)) rmSync(file, { force: true });
});

function plant(relativePath: string, content: string) {
  const absolutePath = join(REPO_ROOT, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
  written.push(absolutePath);
}

describe('module-files', () => {
  it('holds over the real corpus', () => {
    expect(check(gitFiles())).toEqual([]);
  });

  it('reports each planted violation by file and line', () => {
    plant('services/catalog/src/modules/menu/__lint-tmp.repository.ts', 'export const x = 1;\n');
    plant('services/catalog/src/modules/menu/__lint-tmp-unknown-role.ts', 'export const x = 1;\n');
    plant(
      'services/catalog/src/modules/menu/domain/__lint-tmp.ts',
      "import { Injectable } from '@nestjs/common';\nexport class X {}\n",
    );

    const violations = check([
      'services/catalog/src/modules/menu/__lint-tmp.repository.ts',
      'services/catalog/src/modules/menu/__lint-tmp-unknown-role.ts',
      'services/catalog/src/modules/menu/domain/__lint-tmp.ts',
    ]);

    expect(violations).toContainEqual(
      expect.objectContaining({
        file: 'services/catalog/src/modules/menu/__lint-tmp.repository.ts',
      }),
    );
    expect(violations).toContainEqual(
      expect.objectContaining({
        file: 'services/catalog/src/modules/menu/__lint-tmp-unknown-role.ts',
      }),
    );
    expect(violations).toContainEqual(
      expect.objectContaining({
        file: 'services/catalog/src/modules/menu/domain/__lint-tmp.ts',
        line: 1,
      }),
    );
  });

  it('allows a type-only generated/prisma import in domain/*.ts (conventions §2.1)', () => {
    plant(
      'services/catalog/src/modules/menu/domain/__lint-tmp-type-only.ts',
      "import type { Prisma } from '../../../../generated/prisma/client.js';\nexport type X = Prisma.ProductSelect;\n",
    );
    const violations = check(['services/catalog/src/modules/menu/domain/__lint-tmp-type-only.ts']);
    expect(violations).toEqual([]);
  });

  it('refuses a runtime generated/prisma import in domain/*.ts', () => {
    plant(
      'services/catalog/src/modules/menu/domain/__lint-tmp-runtime.ts',
      "import { PrismaClient } from '../../../../generated/prisma/client.js';\nexport const x = new PrismaClient();\n",
    );
    const violations = check(['services/catalog/src/modules/menu/domain/__lint-tmp-runtime.ts']);
    expect(violations).toContainEqual(
      expect.objectContaining({
        file: 'services/catalog/src/modules/menu/domain/__lint-tmp-runtime.ts',
        line: 1,
      }),
    );
  });

  it('accepts every real role pattern', () => {
    plant('services/catalog/src/modules/menu/__lint-tmp.module.ts', 'export class X {}\n');
    plant('services/catalog/src/modules/menu/__lint-tmp.job.ts', 'export class X {}\n');
    const violations = check([
      'services/catalog/src/modules/menu/__lint-tmp.module.ts',
      'services/catalog/src/modules/menu/__lint-tmp.job.ts',
    ]);
    expect(violations).toEqual([]);
  });

  it('the corpus is real', () => {
    const files = modulesFiles(gitFiles());
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain('services/catalog/src/modules/menu/menu.module.ts');
  });
});
