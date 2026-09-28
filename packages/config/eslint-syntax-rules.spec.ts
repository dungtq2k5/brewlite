import { ESLint } from 'eslint';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { baseConfig } from './eslint.config.mjs';

/**
 * Proves the "flat config replaces, never merges" trap of conventions §3.2 stays fixed:
 * a file matched by the RpcException/process.env block (packages/nest-common excepted)
 * must still catch the shared syntax selectors, not just its own two. `projectService`
 * needs a real file under a real tsconfig, so each case writes one, lints it, and
 * removes it.
 */
const written: string[] = [];

afterEach(() => {
  for (const file of written.splice(0)) rmSync(file, { force: true });
});

const REPO_ROOT = join(process.cwd(), '..', '..');

async function lintReal(relativePath: string, code: string) {
  const absolutePath = join(REPO_ROOT, relativePath);
  writeFileSync(absolutePath, code);
  written.push(absolutePath);
  const eslint = new ESLint({ overrideConfigFile: true, baseConfig, cwd: REPO_ROOT });
  const results = await eslint.lintFiles([absolutePath]);
  return results[0]?.messages.map((m) => m.ruleId) ?? [];
}

describe('shared no-restricted-syntax selectors', () => {
  it('reports a bare .sort() in packages/nest-common', async () => {
    const messages = await lintReal(
      'packages/nest-common/src/__lint-tmp-sort.ts',
      'export function f(a: number[]) { return a.sort(); }\n',
    );
    expect(messages).toContain('no-restricted-syntax');
  });

  it('reports localeCompare() in a service', async () => {
    const messages = await lintReal(
      'services/catalog/src/__lint-tmp-locale.ts',
      'export function f(a: string, b: string) { return a.localeCompare(b); }\n',
    );
    expect(messages).toContain('no-restricted-syntax');
  });

  it('reports a hard delete of a soft-deletable model in a service', async () => {
    const messages = await lintReal(
      'services/catalog/src/__lint-tmp-delete.service.ts',
      'declare const prisma: { category: { delete: (x: unknown) => void } };\nexport function f() { prisma.category.delete({}); }\n',
    );
    expect(messages).toContain('no-restricted-syntax');
  });
});
