import { execFileSync } from 'node:child_process';
import { testEnv } from './env.js';

export default function setup(): void {
  const env = { ...process.env, ...testEnv, PRISMA_DB: 'test' };
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { env, stdio: 'inherit' });
  execFileSync(
    'pnpm',
    ['exec', 'prisma', 'db', 'execute', '--file', 'prisma/sql/schema-objects.sql'],
    { env, stdio: 'inherit' },
  );
}
