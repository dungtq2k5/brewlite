import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  DATABASE_URL_SHADOW: z.string().url().optional(),
  GRPC_URL: z.string(),
  OPS_PORT: z.coerce.number().int().positive(),
  CATALOG_GRPC_URL: z.string(),
  NATS_URL: z.string(),
  NATS_URL_TEST: z.string().optional(),
  REDIS_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;
