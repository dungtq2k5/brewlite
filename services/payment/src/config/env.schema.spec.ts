import { describe, expect, it } from 'vitest';
import { envSchema } from './env.schema.js';

const BASE = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  GRPC_URL: '0.0.0.0:25054',
  OPS_PORT: '23104',
  ORDERING_GRPC_URL: 'localhost:25053',
  NATS_URL: 'nats://localhost:4222',
  REDIS_URL: 'redis://localhost:6379/0',
};

describe('envSchema', () => {
  it('refuses PAYMENT_PROVIDER=fake with NODE_ENV=production', () => {
    const result = envSchema.safeParse({
      ...BASE,
      NODE_ENV: 'production',
      PAYMENT_PROVIDER: 'fake',
    });
    expect(result.success).toBe(false);
  });

  it('allows PAYMENT_PROVIDER=fake with NODE_ENV=development', () => {
    const result = envSchema.safeParse({
      ...BASE,
      NODE_ENV: 'development',
      PAYMENT_PROVIDER: 'fake',
    });
    expect(result.success).toBe(true);
  });

  it('allows PAYMENT_PROVIDER=stripe with NODE_ENV=production', () => {
    const result = envSchema.safeParse({
      ...BASE,
      NODE_ENV: 'production',
      PAYMENT_PROVIDER: 'stripe',
      STRIPE_SECRET_KEY: 'rk_live_abc',
      STRIPE_WEBHOOK_SECRET: 'whsec_abc',
      WEB_URL: 'https://brewlite.example',
    });
    expect(result.success).toBe(true);
  });

  describe('PAYMENT_PROVIDER=stripe', () => {
    const stripeEnv = {
      ...BASE,
      NODE_ENV: 'development',
      PAYMENT_PROVIDER: 'stripe',
      STRIPE_SECRET_KEY: 'rk_test_abc',
      STRIPE_WEBHOOK_SECRET: 'whsec_abc',
      WEB_URL: 'http://localhost:23000',
    };

    it('accepts a restricted key with both secrets and WEB_URL', () => {
      expect(envSchema.safeParse(stripeEnv).success).toBe(true);
    });

    it('refuses a full-access key', () => {
      expect(envSchema.safeParse({ ...stripeEnv, STRIPE_SECRET_KEY: 'sk_test_abc' }).success).toBe(
        false,
      );
    });

    it.each(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'WEB_URL'])('requires %s', (name) => {
      expect(envSchema.safeParse({ ...stripeEnv, [name]: undefined }).success).toBe(false);
    });

    it('the fake provider needs none of them', () => {
      expect(
        envSchema.safeParse({ ...BASE, NODE_ENV: 'development', PAYMENT_PROVIDER: 'fake' }).success,
      ).toBe(true);
    });
  });
});
