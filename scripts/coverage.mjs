#!/usr/bin/env node
// `pnpm coverage`: every package's coverage, then the check. Needs the infrastructure up (the
// backend's integration tiers) and the services running (the web's e2e run, on the coverage
// build at :23000 — the web and Caddy containers must be stopped). Always on the fake payment
// provider, so the payment flow counts — the same refusal as `seed:dev:apply`.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEnvText } from './seed-dev-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const paymentEnv = path.join(ROOT, 'services', 'payment', '.env');
const provider = existsSync(paymentEnv)
  ? readEnvText(readFileSync(paymentEnv, 'utf8')).PAYMENT_PROVIDER
  : undefined;
if (provider !== 'fake') {
  console.error(
    '✗ The coverage run uses the fake payment provider — set PAYMENT_PROVIDER=fake in services/payment/.env and restart payment.',
  );
  process.exit(1);
}

const run = (command, args, cwd = ROOT) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run('pnpm', ['exec', 'turbo', 'run', 'test:coverage']);
run('pnpm', ['--filter', '@brewlite/web', 'coverage']);
run('node', ['scripts/coverage-check.mjs']);
