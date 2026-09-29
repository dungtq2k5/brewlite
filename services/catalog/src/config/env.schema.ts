import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  DATABASE_URL_SHADOW: z.string().url().optional(),
  GRPC_URL: z.string(),
  OPS_PORT: z.coerce.number().int().positive(),
  REDIS_URL: z.string().url(),
  REDIS_URL_TEST: z.string().url().optional(),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_STORAGE_BUCKET: z.string().min(1),
  FIREBASE_STORAGE_EMULATOR_HOST: z.string().min(1).optional(),
  STORAGE_PUBLIC_BASE_URL: z.string().url(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;
