import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '../../generated/prisma/client.js';
import { testEnv } from './env.js';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: testEnv.DATABASE_URL_TEST }),
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE payments, outbox_events RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});
