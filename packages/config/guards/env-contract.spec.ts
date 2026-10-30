import { pathToFileURL } from 'node:url';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ZodObject } from 'zod';
import { gitFiles, readRepoFile } from './lib/corpus.js';

interface Violation {
  file: string;
  line: number;
  message: string;
}

const REPO_ROOT = join(__dirname, '..', '..', '..');

function envSchemaFiles(files: string[]): string[] {
  return files.filter((f) => /^(?:services|apps)\/[^/]+\/src\/config\/env\.schema\.ts$/.test(f));
}

function parseEnvExample(content: string): Set<string> {
  const keys = new Set<string>();
  for (const line of content.split('\n')) {
    const match = /^([A-Z][A-Z0-9_]*)=/.exec(line.trim());
    if (match) keys.add(match[1]!);
  }
  return keys;
}

function architectureKeys(architectureDoc: string): Set<string> {
  const keys = new Set<string>();
  const section = architectureDoc.split('## 10. Environment variables')[1]?.split('\n## ')[0] ?? '';
  for (const line of section.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const firstCell = line.split('|')[1] ?? '';
    for (const match of firstCell.matchAll(/`([A-Z][A-Z0-9_]*)`/g)) {
      keys.add(match[1]!);
    }
  }
  return keys;
}

async function check(files: string[]): Promise<Violation[]> {
  const violations: Violation[] = [];
  const architectureDoc = readRepoFile('docs/architecture-and-tech-stack.md');
  const docKeys = architectureKeys(architectureDoc);

  for (const file of envSchemaFiles(files)) {
    const [workspace, service] = file.split('/') as [string, string];
    const absolutePath = join(REPO_ROOT, file);
    const mod = (await import(pathToFileURL(absolutePath).href)) as { envSchema: ZodObject };
    const schemaKeys = new Set(Object.keys(mod.envSchema.shape));

    const exampleFile = `${workspace}/${service}/.env.example`;
    let exampleKeys: Set<string>;
    try {
      exampleKeys = parseEnvExample(readRepoFile(exampleFile));
    } catch {
      violations.push({ file, line: 1, message: `${exampleFile} is missing or not tracked` });
      continue;
    }

    for (const key of schemaKeys) {
      if (!exampleKeys.has(key)) {
        violations.push({
          file,
          line: 1,
          message: `${key} is in envSchema but not in .env.example`,
        });
      }
      if (!docKeys.has(key)) {
        violations.push({
          file,
          line: 1,
          message: `${key} is in envSchema but not in architecture §10`,
        });
      }
    }
    for (const key of exampleKeys) {
      if (!schemaKeys.has(key)) {
        violations.push({
          file,
          line: 1,
          message: `${key} is in .env.example but not in envSchema`,
        });
      }
    }
  }
  return violations;
}

/**
 * Turbo's strict env mode hands a task only the variables `turbo.json` declares, and `next build`
 * validates `serverEnvSchema` in its page-data step: a required web server variable missing from
 * `globalPassThroughEnv` passes every test and breaks only the Docker build. Entries match exactly
 * or by a trailing `*`.
 */
export function missingPassThrough(required: string[], passThrough: string[]): string[] {
  const covers = (entry: string, key: string) =>
    entry.endsWith('*') ? key.startsWith(entry.slice(0, -1)) : entry === key;
  return required.filter((key) => !passThrough.some((entry) => covers(entry, key)));
}

const WEB_SCHEMA = 'apps/web/src/config/env.schema.ts';

async function webBuildEnvViolations(passThrough: string[]): Promise<Violation[]> {
  const mod = (await import(pathToFileURL(join(REPO_ROOT, WEB_SCHEMA)).href)) as {
    serverEnvSchema: ZodObject;
  };
  // Required = no `.optional()`, no `.default()`: parsing `undefined` fails.
  const required = Object.entries(mod.serverEnvSchema.shape)
    .filter(([, schema]) => !schema.safeParse(undefined).success)
    .map(([key]) => key);
  return missingPassThrough(required, passThrough).map((key) => ({
    file: WEB_SCHEMA,
    line: 1,
    message: `${key} is required by apps/web serverEnvSchema but not in turbo.json globalPassThroughEnv — next build would fail`,
  }));
}

const turboPassThrough = (): string[] =>
  (JSON.parse(readRepoFile('turbo.json')) as { globalPassThroughEnv?: string[] })
    .globalPassThroughEnv ?? [];

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

describe('env-contract', () => {
  it('holds over the real corpus', async () => {
    expect(await check(gitFiles())).toEqual([]);
  });

  it('the corpus is real', () => {
    const files = envSchemaFiles(gitFiles());
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain('services/catalog/src/config/env.schema.ts');
    expect(files).toContain('apps/web/src/config/env.schema.ts');
  });

  it('accepts a conforming shape (catalog matches itself)', async () => {
    const violations = (await check(gitFiles())).filter((v) => v.file.includes('catalog'));
    expect(violations).toEqual([]);
  });

  it('reports each planted violation by file', async () => {
    plant(
      'services/__lint-tmp-service/src/config/env.schema.ts',
      // The guard only reads `.shape`'s keys — a plain object avoids needing `zod`
      // resolvable from a directory that isn't a real workspace package.
      [
        'export const envSchema = {',
        '  shape: { NODE_ENV: null, ONLY_IN_SCHEMA: null },', // ONLY_IN_SCHEMA missing from .env.example and architecture §10
        '};',
      ].join('\n'),
    );
    plant(
      'services/__lint-tmp-service/.env.example',
      ['NODE_ENV=development', 'ONLY_IN_EXAMPLE=x'].join('\n'), // missing from envSchema
    );

    const violations = await check([
      'services/__lint-tmp-service/src/config/env.schema.ts',
      'services/__lint-tmp-service/.env.example',
    ]);

    expect(
      violations.some(
        (v) => v.message.includes('ONLY_IN_SCHEMA') && v.message.includes('.env.example'),
      ),
    ).toBe(true);
    expect(
      violations.some(
        (v) => v.message.includes('ONLY_IN_SCHEMA') && v.message.includes('architecture'),
      ),
    ).toBe(true);
    expect(
      violations.some(
        (v) => v.message.includes('ONLY_IN_EXAMPLE') && v.message.includes('envSchema'),
      ),
    ).toBe(true);
  });

  it('every required web server variable reaches `next build` through turbo.json', async () => {
    expect(await webBuildEnvViolations(turboPassThrough())).toEqual([]);
  });

  it('names the variable and turbo.json when one is not passed through', async () => {
    const without = turboPassThrough().filter((entry) => entry !== 'STORAGE_PUBLIC_BASE_URL');
    const violations = await webBuildEnvViolations(without);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain('STORAGE_PUBLIC_BASE_URL');
    expect(violations[0]!.message).toContain('turbo.json');
  });
});

describe('missingPassThrough', () => {
  it('accepts an exact entry and a trailing-* wildcard', () => {
    expect(
      missingPassThrough(['API_URL', 'DATABASE_URL_TEST'], ['API_URL', 'DATABASE_URL*']),
    ).toEqual([]);
  });

  it('returns what no entry covers', () => {
    expect(missingPassThrough(['API_URL', 'OTHER'], ['API_URL', 'DATABASE_URL*'])).toEqual([
      'OTHER',
    ]);
  });

  it('does not treat a prefix without * as a match', () => {
    expect(missingPassThrough(['API_URL_X'], ['API_URL'])).toEqual(['API_URL_X']);
  });
});
