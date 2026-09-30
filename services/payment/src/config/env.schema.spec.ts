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
    });
    expect(result.success).toBe(true);
  });
});
