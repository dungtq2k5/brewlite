#!/usr/bin/env node
// pnpm --filter @brewlite/identity firebase:dev-token — prints a real emulator-issued ID
// token for a fake Google/Apple sign-in, for `curl` against POST /auth/firebase without a
// browser. Development only — refuses without FIREBASE_AUTH_EMULATOR_HOST (architecture §5).
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { getEmulatorIdToken } from '../test/support/emulator-token.ts';

config({ path: resolve(import.meta.dirname, '../.env') });

// `pnpm run firebase:dev-token -- --provider ...` forwards the routing `--` itself,
// unlike npm — parseArgs treats a bare `--` as "everything after is positional", so it
// is stripped here.
const args = process.argv.slice(2).filter((arg) => arg !== '--');

const { values } = parseArgs({
  args,
  options: {
    provider: { type: 'string', default: 'google.com' },
    email: { type: 'string', default: 'dev@example.com' },
    name: { type: 'string' },
    unverified: { type: 'boolean', default: false },
  },
});

if (values.provider !== 'google.com' && values.provider !== 'apple.com') {
  console.error('--provider must be google.com or apple.com');
  process.exit(1);
}

const idToken = await getEmulatorIdToken({
  provider: values.provider,
  email: values.email,
  emailVerified: !values.unverified,
  name: values.name ?? null,
});

// Printed only if it is a JWT (the emulator's tokens are unsigned, so the third segment may
// be empty) — nothing else the network returned reaches the terminal, and the refusal does
// not echo it.
if (!/^[\w-]+\.[\w-]+\.[\w-]*$/.test(idToken)) {
  console.error('the emulator did not return a JWT');
  process.exit(1);
}

console.log(idToken);
