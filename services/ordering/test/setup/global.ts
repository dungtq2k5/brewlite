import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { connect } from 'nats';
import { ensureStreams } from '@brewlite/nest-common';
import { testEnv } from './env.js';

// Vitest provides __filename (corpus.ts already relies on __dirname); a bare `require` is not
// guaranteed. Named `requireHere`, not `require` — this compiles as CommonJS, where `require`
// is reserved and `tsc` refuses to emit a shadowing declaration (TS2441).
const requireHere = createRequire(__filename);
const prismaPkg = requireHere.resolve('prisma/package.json');
const PRISMA_CLI = join(
  dirname(prismaPkg),
  (requireHere(prismaPkg) as { bin: { prisma: string } }).bin.prisma,
);

/**
 * The test NATS has no volume: recreating its container drops the JetStream streams, and the
 * outbox relay's tests then publish into nothing. Ensure them here, the way a service does at boot.
 */
async function ensureTestStreams(): Promise<void> {
  const nc = await connect({ servers: testEnv.NATS_URL_TEST, timeout: 5000 });
  try {
    await ensureStreams(await nc.jetstreamManager(), ['ORDERING', 'PAYMENT', 'DLQ']);
  } finally {
    await nc.close();
  }
}

export default async function setup(): Promise<void> {
  const env = { ...process.env, ...testEnv, PRISMA_DB: 'test' };
  execFileSync(process.execPath, [PRISMA_CLI, 'migrate', 'deploy'], { env, stdio: 'inherit' });
  execFileSync(
    process.execPath,
    [PRISMA_CLI, 'db', 'execute', '--file', 'prisma/sql/schema-objects.sql'],
    { env, stdio: 'inherit' },
  );
  await ensureTestStreams();
}
