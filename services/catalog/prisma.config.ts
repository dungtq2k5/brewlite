import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

const TARGETS = { working: 'DATABASE_URL', test: 'DATABASE_URL_TEST' } as const;
const db = process.env.PRISMA_DB ?? 'working';
if (!Object.hasOwn(TARGETS, db)) throw new Error(`Unknown PRISMA_DB "${db}"`);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: env(TARGETS[db as keyof typeof TARGETS]),
    shadowDatabaseUrl: env('DATABASE_URL_SHADOW'),
  },
});
