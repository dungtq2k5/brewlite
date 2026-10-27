import { z } from 'zod';

export const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_URL: z.string().url().default('http://127.0.0.1:23100/api/v1'),
    IMAGE_REMOTE_HOSTS: z.string().default('localhost:29199'),
    NEXT_PUBLIC_FIREBASE_API_KEY: z.string().default('demo-key'),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().default('demo-brewlite.firebaseapp.com'),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().default('demo-brewlite'),
    NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL: z.string().optional(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);