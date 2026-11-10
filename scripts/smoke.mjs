// `pnpm smoke` — is the stack alive, and does J1 work? About a minute, against any running stack:
// local Compose by default, a deployed one through the SMOKE_* variables.
//
//   SMOKE_BASE_URL        the web app (default http://localhost:23000, through Caddy)
//   SMOKE_API_URL         the gateway (default http://localhost:23100)
//   SMOKE_OPS_URLS        service ops bases, comma-separated (default the four local ones;
//                         empty → only the gateway's readiness is checked)
//   SMOKE_STAFF_EMAIL     default staff@brewlite.test
//   SMOKE_STAFF_PASSWORD  default SEED_ACCOUNT_PASSWORD (environment, then services/identity/.env)
//
// Step 1, health, starts no browser; a failure stops everything. Step 2 runs the Playwright
// `smoke` project (apps/web/e2e/smoke/j1.spec.ts).
/* global fetch, AbortSignal */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEnvText } from './seed-dev-lib.mjs';
import { healthReport, nameFor, parseOpsUrls } from './smoke-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.SMOKE_BASE_URL ?? 'http://localhost:23000').replace(/\/+$/, '');
const API = (process.env.SMOKE_API_URL ?? 'http://localhost:23100').replace(/\/+$/, '');
const OPS = parseOpsUrls(process.env.SMOKE_OPS_URLS);

function staffPassword() {
  if (process.env.SMOKE_STAFF_PASSWORD) return process.env.SMOKE_STAFF_PASSWORD;
  if (process.env.SEED_ACCOUNT_PASSWORD) return process.env.SEED_ACCOUNT_PASSWORD;
  const file = path.join(ROOT, 'services', 'identity', '.env');
  return existsSync(file)
    ? readEnvText(readFileSync(file, 'utf8')).SEED_ACCOUNT_PASSWORD
    : undefined;
}

async function check(name, url, accept = (r) => r.ok) {
  const started = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!(await accept(response))) return { name, ok: false, error: `answered ${response.status}` };
    return { name, ok: true, ms: Date.now() - started };
  } catch (error) {
    return {
      name,
      ok: false,
      error:
        error.name === 'TimeoutError' ? 'no answer in 5 s' : (error.cause?.code ?? error.message),
    };
  }
}

console.log(`smoke · ${BASE}\n\n1. Health`);
const results = await Promise.all([
  check('gateway', `${API}/health/ready`),
  ...OPS.map((url) => check(nameFor(url), `${url}/health/ready`)),
  // The menu's markup, not just a 200: the category navigation is on the server-rendered page.
  check('web', `${BASE}/`, async (r) => r.ok && /aria-label="Categories"/.test(await r.text())),
]);
const health = healthReport(results);
for (const line of health.lines) console.log(`   ${line}`);
if (!health.ok) {
  console.error('\n✗ Not healthy — the journey was not run.');
  process.exit(1);
}

const password = staffPassword();
if (!password) {
  console.error(
    '\n✗ Set SMOKE_STAFF_PASSWORD (or SEED_ACCOUNT_PASSWORD) — the staff account moves the order.',
  );
  process.exit(1);
}

console.log('\n2. J1 — a guest orders, pays and collects');
const run = spawnSync(
  'pnpm',
  [
    '--filter',
    '@brewlite/web',
    'exec',
    'playwright',
    'test',
    '--project',
    'smoke',
    '--reporter',
    'list',
  ],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      E2E_BASE_URL: BASE,
      SMOKE_API_URL: API,
      SMOKE_STAFF_EMAIL: process.env.SMOKE_STAFF_EMAIL ?? 'staff@brewlite.test',
      SMOKE_STAFF_PASSWORD: password,
    },
  },
);
console.log(
  run.status === 0
    ? '\n✓ Smoke passed.'
    : '\n✗ Smoke failed — the journey stopped at the step above.',
);
process.exit(run.status ?? 1);
