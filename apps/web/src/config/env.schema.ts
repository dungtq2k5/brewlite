import { z } from 'zod';

/** Compiled into the browser bundle — URLs and the Firebase web config only (conventions §11.5). */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL: z.string().optional(),
  NEXT_PUBLIC_APPLE_SIGN_IN_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export const serverEnvSchema = z.object({
  /** The gateway's origin plus its prefix; server only (architecture §4.2). */
  API_URL: z.url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/** Everything, for the `env-contract` guard. */
export const envSchema = serverEnvSchema.extend(publicEnvSchema.shape);

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

// `NEXT_PUBLIC_*` are inlined only where written out as `process.env.NEXT_PUBLIC_X`, so the
// object is built literally rather than by iterating `process.env`.
export function parsePublicEnv(): PublicEnv {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL || undefined,
    NEXT_PUBLIC_APPLE_SIGN_IN_ENABLED: process.env.NEXT_PUBLIC_APPLE_SIGN_IN_ENABLED || undefined,
  });
}

export function parseServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    API_URL: process.env.API_URL,
    NODE_ENV: process.env.NODE_ENV,
  });
}
