import { PrismaPg } from '@prisma/adapter-pg';
import { Redis } from 'ioredis';
import { afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '../../generated/prisma/client.js';
import { testEnv } from './env.js';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: testEnv.DATABASE_URL_TEST }),
});

export const testRedis = new Redis(testEnv.REDIS_URL_TEST);

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE categories, products, product_sizes, toppings, product_toppings RESTART IDENTITY CASCADE',
  );
  await testRedis.flushdb();
});

afterAll(async () => {
  await prisma.$disconnect();
  await testRedis.quit();
});
