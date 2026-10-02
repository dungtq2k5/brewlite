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
    ORDERING_GRPC_URL: z.string(),
    NATS_URL: z.string(),
    NATS_URL_TEST: z.string().optional(),
    REDIS_URL: z.string().url(),
    PAYMENT_PROVIDER: z.enum(['fake', 'stripe']),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    WEB_URL: z.string().url().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.PAYMENT_PROVIDER === 'stripe') {
      const need = (path: 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET' | 'WEB_URL') => {
        if (!env[path])
          ctx.addIssue({
            code: 'custom',
            path: [path],
            message: 'required when PAYMENT_PROVIDER=stripe',
          });
      };
      need('STRIPE_SECRET_KEY');
      need('STRIPE_WEBHOOK_SECRET');
      need('WEB_URL');
      // A restricted key only (architecture §6): a leaked full-access key must not be accepted.
      if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith('rk_')) {
        ctx.addIssue({
          code: 'custom',
          path: ['STRIPE_SECRET_KEY'],
          message: 'must be a restricted key (rk_…)',
        });
      }
    }
    // A production switch that lets anyone mark an order paid must be impossible, not
    // merely unused — the same rule as identity's Auth-emulator refusal (architecture §6).
    if (env.NODE_ENV === 'production' && env.PAYMENT_PROVIDER === 'fake') {
      ctx.addIssue({
        code: 'custom',
        path: ['PAYMENT_PROVIDER'],
        message: 'must not be "fake" when NODE_ENV=production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
