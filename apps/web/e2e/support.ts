import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { expect, test as base, type Page } from '@playwright/test';

export const GATEWAY = process.env.E2E_GATEWAY_URL ?? 'http://localhost:23100/api/v1';

const DOCKER = ['/usr/bin/docker', '/usr/local/bin/docker'].find((p) => existsSync(p));

/**
 * `AUTH` is 10 requests per 15 minutes per address and per email, and every spec comes from
 * one address (behind Caddy it is always the same one). Each test starts from empty buckets.
 */
export function resetAuthRateLimits(): void {
  if (!DOCKER)
    throw new Error('docker not found — the specs reset the gateway rate limits through Redis');
  execFileSync(
    DOCKER,
    [
      'compose',
      'exec',
      '-T',
      'redis',
      'sh',
      '-c',
      "redis-cli --scan --pattern 'gw:rl:AUTH:*' | xargs -r redis-cli del",
    ],
    { cwd: new URL('../../..', import.meta.url).pathname, stdio: 'ignore' },
  );
}

export const test = base.extend<{ freshBuckets: void }>({
  freshBuckets: [
    // Playwright requires the destructuring pattern even when no fixture is used.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      resetAuthRateLimits();
      await use();
    },
    { auto: true },
  ],
});
export { expect };

export const PASSWORD = 'Passw0rd!23';

export function seedPassword(): string {
  const value = process.env.SEED_ACCOUNT_PASSWORD;
  if (!value) throw new Error('set SEED_ACCOUNT_PASSWORD to the password the dev seed used');
  return value;
}

export const newEmail = () => `e2e-${crypto.randomUUID()}@example.com`;

/** Registers through the form and waits until the customer header shows. */
export async function register(page: Page, email = newEmail(), fullName = 'Lan Anh') {
  await page.goto('/register');
  await page.getByLabel('Full name').fill(fullName);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
  return { email, password: PASSWORD, fullName };
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** A direct call to the gateway — setup only (an account to lock, an admin token). */
export async function api<T = unknown>(path: string, init: RequestInit & { token?: string } = {}) {
  const { token, ...rest } = init;
  const response = await fetch(`${GATEWAY}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(rest.headers as Record<string, string> | undefined),
    },
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T };
}

export async function adminToken(): Promise<string> {
  const { body } = await api<{ data: { accessToken: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@brewlite.test', password: seedPassword() }),
  });
  return body.data.accessToken;
}

export async function createAccount(email = newEmail()) {
  const { body } = await api<{ data: { user: { id: string } } }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD, fullName: 'Lan Anh' }),
  });
  return { email, id: body.data.user.id };
}
