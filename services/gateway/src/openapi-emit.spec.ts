import { readFileSync, rmSync } from 'node:fs';
import type * as Fs from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';

/**
 * `openapi-emit.ts` is a script: importing it runs `main()`, which writes beside the build
 * output. Its only seam is `writeFileSync`, so the mock below redirects that one write into
 * a temp directory and leaves every other `node:fs` call real.
 */
const emitted = vi.hoisted(() => {
  let settle!: (write: { target: string; written: string }) => void;
  return { done: new Promise<{ target: string; written: string }>((r) => (settle = r)), settle };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof Fs>();
  return {
    ...actual,
    writeFileSync: (target: string, data: string) => {
      const written = join(actual.mkdtempSync(join(tmpdir(), 'gateway-openapi-')), 'openapi.json');
      actual.writeFileSync(written, data);
      emitted.settle({ target, written });
    },
  };
});

afterAll(async () => {
  const { written } = await emitted.done;
  rmSync(dirname(written), { recursive: true, force: true });
});

describe('openapi-emit', () => {
  it('emits EXACTLY the committed openapi.json', async () => {
    await import('./openapi-emit.js');
    const { target, written } = await emitted.done;

    expect(basename(target)).toBe('openapi.json');
    const committed = readFileSync(resolve(__dirname, '..', 'openapi.json'), 'utf8');
    expect(readFileSync(written, 'utf8')).toBe(committed);
  }, 30_000);
});
