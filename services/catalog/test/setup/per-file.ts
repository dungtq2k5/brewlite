import { PrismaPg } from '@prisma/adapter-pg';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { Redis } from 'ioredis';
import { afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '../../generated/prisma/client.js';
import { testEnv } from './env.js';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: testEnv.DATABASE_URL_TEST }),
});

export const testRedis = new Redis(testEnv.REDIS_URL_TEST);

if (getApps().length === 0) {
  initializeApp({
    projectId: testEnv.FIREBASE_PROJECT_ID,
    storageBucket: testEnv.FIREBASE_STORAGE_BUCKET,
  });
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE categories, products, product_sizes, toppings, product_toppings RESTART IDENTITY CASCADE',
  );
  await testRedis.flushdb();
  // The emulator's bucket does not exist until the first object is ever written to it —
  // `deleteFiles` on a bucket with nothing in it yet throws, not something to clean up.
  await getStorage()
    .bucket()
    .deleteFiles({ prefix: 'products/' })
    .catch(() => {});
});

afterAll(async () => {
  await prisma.$disconnect();
  await testRedis.quit();
});
