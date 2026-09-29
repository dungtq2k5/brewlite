import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.string().default('info'),
    DATABASE_URL: z.string().url(),
    DATABASE_URL_TEST: z.string().url().optional(),
    DATABASE_URL_SHADOW: z.string().url().optional(),
    GRPC_URL: z.string(),
    OPS_PORT: z.coerce.number().int().positive(),
    REDIS_URL: z.string().url(),
    JWT_PRIVATE_KEY: z.string().min(1),
    JWT_KEY_ID: z.string().min(1),
    FIREBASE_PROJECT_ID: z.string().min(1),
    FIREBASE_AUTH_EMULATOR_HOST: z.string().min(1).optional(),
    GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    // `firebase-admin` accepts unsigned tokens whenever this variable is set — that is
    // how the emulator works. A production identity with it set would accept a forged
    // token for any email (architecture §5).
    if (env.NODE_ENV === 'production' && env.FIREBASE_AUTH_EMULATOR_HOST !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['FIREBASE_AUTH_EMULATOR_HOST'],
        message: 'must be unset when NODE_ENV=production — the emulator accepts forged tokens',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
