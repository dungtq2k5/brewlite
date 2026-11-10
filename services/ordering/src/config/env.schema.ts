import { zNodeEnv } from '@brewlite/contracts';
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: zNodeEnv,
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.url(),
  DATABASE_URL_TEST: z.url().optional(),
  DATABASE_URL_SHADOW: z.url().optional(),
  GRPC_URL: z.string(),
  OPS_PORT: z.coerce.number().int().positive(),
  CATALOG_GRPC_URL: z.string(),
  NATS_URL: z.string(),
  NATS_URL_TEST: z.string().optional(),
  REDIS_URL: z.url(),
});

export type Env = z.infer<typeof envSchema>;
