#!/usr/bin/env node
// The web's coverage, locally: the coverage build, its server at :23000 recording V8
// (NODE_V8_COVERAGE), the e2e suite with the browser recording too (WEB_COVERAGE=1), the server
// stopped by SIGTERM, Vitest's share, then the merge (coverage-report.mjs). The services must be
// running; :23000 must be free (stop the web and Caddy containers).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { readEnvText } from '../../../scripts/seed-dev-lib.mjs';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const ROOT = path.resolve(WEB, '..', '..');
const BASE = 'http://localhost:23000';
const RAW = path.join(WEB, 'coverage', 'raw');

/**
 * Next's standalone server has no SIGTERM handler, so the signal kills it before V8 writes
 * NODE_V8_COVERAGE. This exits cleanly instead. Percent-encoded: NODE_OPTIONS strips `"`.
 */
const EXIT_ON_SIGTERM =
  '--import=data:text/javascript,process.on(%22SIGTERM%22,()=>process.exit(0))';

const busy = () =>
  new Promise((resolve) => {
    const socket = createConnection(23000, 'localhost');
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
  });
const step = (command, args, env = {}) => {
  const result = spawnSync(command, args, {
    cwd: WEB,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (await busy()) {
  console.error('✗ :23000 is taken — stop the web and Caddy containers (or `next start`) first.');
  process.exit(1);
}
const identityEnv = path.join(ROOT, 'services', 'identity', '.env');
const seedPassword =
  process.env.SEED_ACCOUNT_PASSWORD ??
  (existsSync(identityEnv)
    ? readEnvText(readFileSync(identityEnv, 'utf8')).SEED_ACCOUNT_PASSWORD
    : undefined);

rmSync(path.join(WEB, 'coverage'), { recursive: true, force: true });
step('pnpm', ['exec', 'next', 'build'], { WEB_COVERAGE: '1' });

// `node scripts/start.mjs`, not `pnpm start`: the pnpm launcher may lack the inspector V8 needs.
const server = spawn(process.execPath, ['scripts/start.mjs'], {
  cwd: WEB,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_V8_COVERAGE: path.join(RAW, 'server'),
    NODE_OPTIONS: [process.env.NODE_OPTIONS, EXIT_ON_SIGTERM].filter(Boolean).join(' '),
  },
});
const stopped = new Promise((resolve) => server.once('exit', resolve));
for (let i = 0; i < 60 && !(await busy()); i++) await sleep(1000);

const e2e = spawnSync(
  'pnpm',
  ['exec', 'playwright', 'test', '--project', 'phone', '--project', 'narrow'],
  {
    cwd: WEB,
    stdio: 'inherit',
    env: {
      ...process.env,
      WEB_COVERAGE: '1',
      E2E_BASE_URL: BASE,
      SEED_ACCOUNT_PASSWORD: seedPassword,
    },
  },
);
server.kill('SIGTERM');
await stopped;
if (e2e.status !== 0) process.exit(e2e.status ?? 1);

step('pnpm', ['exec', 'vitest', 'run', '-c', 'vitest.coverage.config.mts', '--coverage']);
step(process.execPath, ['scripts/coverage-report.mjs']);
