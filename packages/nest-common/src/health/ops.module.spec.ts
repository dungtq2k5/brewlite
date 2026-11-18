import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type INestApplication, Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { OpsModule } from './ops.module.js';
import type { ReadinessCheck } from './readiness.js';

const ok: ReadinessCheck = () => Promise.resolve(true);
const down: ReadinessCheck = () => Promise.resolve(false);

let root: string;
let app: INestApplication | undefined;

/** A service root with a `package.json`, and a nested directory like a compiled `dist/src`. */
function serviceDir(pkg: object): string {
  const dir = mkdtempSync(join(root, 'svc-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
  const nested = join(dir, 'dist', 'src');
  mkdirSync(nested, { recursive: true });
  return nested;
}

async function start(ops: DynamicModule, env: Record<string, string> = {}) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => env] }),
      ops,
    ],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  return async (path: string) => {
    const res = await fetch(`${base}${path}`);
    return { status: res.status, body: await res.json() };
  };
}

describe('OpsModule', () => {
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'brewlite-ops-'));
  });
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('answers /health with ok', async () => {
    const get = await start(OpsModule.forRoot({ packageJsonDir: serviceDir({}) }));
    expect(await get('/health')).toEqual({ status: 200, body: { status: 'ok' } });
  });

  it('is ready with no checks, and when EVERY check passes', async () => {
    let get = await start(OpsModule.forRoot({ packageJsonDir: serviceDir({}) }));
    expect(await get('/health/ready')).toEqual({ status: 200, body: { status: 'ok' } });
    await app!.close();

    get = await start(
      OpsModule.forRoot({ packageJsonDir: serviceDir({}), readinessChecks: [ok, ok] }),
    );
    expect(await get('/health/ready')).toEqual({ status: 200, body: { status: 'ok' } });
  });

  it('answers 503 when ANY check fails', async () => {
    const get = await start(
      OpsModule.forRoot({ packageJsonDir: serviceDir({}), readinessChecks: [ok, down] }),
    );
    expect(await get('/health/ready')).toEqual({ status: 503, body: { status: 'unavailable' } });
  });

  it('reports the NEAREST package.json above the entry point, and the build from config', async () => {
    const get = await start(
      OpsModule.forRoot({ packageJsonDir: serviceDir({ name: '@brewlite/x', version: '1.2.3' }) }),
      { GIT_SHA: 'abc123', BUILT_AT: '2026-11-18T00:00:00Z' },
    );
    expect((await get('/version')).body).toEqual({
      service: '@brewlite/x',
      version: '1.2.3',
      gitSha: 'abc123',
      builtAt: '2026-11-18T00:00:00Z',
    });
  });

  it('reports unknown for whatever package.json and config leave out', async () => {
    const get = await start(OpsModule.forRoot({ packageJsonDir: serviceDir({}) }));
    expect((await get('/version')).body).toEqual({
      service: 'unknown',
      version: 'unknown',
      gitSha: 'unknown',
      builtAt: 'unknown',
    });
  });

  it('refuses to boot when NO package.json is found up to the filesystem root', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'brewlite-ops-nopkg-'));
    try {
      await expect(
        Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
            OpsModule.forRoot({ packageJsonDir: empty }),
          ],
        }).compile(),
      ).rejects.toThrow(`No package.json found above ${empty}`);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  describe('forRootAsync', () => {
    const PROBE = 'PROBE';
    const probe = { up: true };

    @Module({ providers: [{ provide: PROBE, useValue: probe }], exports: [PROBE] })
    class ProbeModule {}

    it('builds its checks from injected providers of the imported modules', async () => {
      const get = await start(
        OpsModule.forRootAsync({
          packageJsonDir: serviceDir({}),
          imports: [ProbeModule],
          inject: [PROBE],
          useFactory: (p: typeof probe) => [() => Promise.resolve(p.up)],
        }),
      );
      expect((await get('/health/ready')).status).toBe(200);
      probe.up = false;
      expect(await get('/health/ready')).toEqual({ status: 503, body: { status: 'unavailable' } });
    });

    it('works with neither imports nor inject', async () => {
      const get = await start(
        OpsModule.forRootAsync({ packageJsonDir: serviceDir({}), useFactory: () => [down] }),
      );
      expect((await get('/health/ready')).status).toBe(503);
    });
  });
});
