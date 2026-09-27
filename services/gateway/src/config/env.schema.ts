import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  PORT: z.coerce.number().int().positive(),
  GLOBAL_PREFIX: z.string().default('api'),
  // z.coerce.boolean() reads the string "false" as true — parse the literal instead.
  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative(),
  CATALOG_GRPC_URL: z.string(),
});

export type Env = z.infer<typeof envSchema>;
