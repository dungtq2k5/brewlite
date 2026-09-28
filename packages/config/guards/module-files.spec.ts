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
        if (/from ['"]@nestjs\//.test(line) || /generated\/prisma/.test(line)) {
          violations.push({
            file,
            line: i + 1,
            message: 'domain/*.ts imports @nestjs/ or generated/prisma (conventions §2.1)',
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
