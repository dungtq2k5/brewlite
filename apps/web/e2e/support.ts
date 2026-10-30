import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { expect, test as base, type Page } from '@playwright/test';

export const GATEWAY = process.env.E2E_GATEWAY_URL ?? 'http://localhost:23100/api/v1';

const DOCKER = ['/usr/bin/docker', '/usr/local/bin/docker'].find((p) => existsSync(p));

/**
 * `AUTH` is 10 requests per 15 minutes per address, `PUBLIC_READ` 120 per minute (the menu
 * specs read public routes often), and `ORDER_WRITE` / `PAYMENT` are per user (the checkout specs
 * quote, place and pay many times), and every spec comes from one address — behind Caddy it is
 * always the same one. Each test starts from empty buckets.
 */
export function resetRateLimits(): void {
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
      "for p in 'gw:rl:AUTH:*' 'gw:rl:PUBLIC_READ:*' 'gw:rl:ORDER_WRITE:*' 'gw:rl:PAYMENT:*'; do redis-cli --scan --pattern \"$p\" | xargs -r redis-cli del; done",
    ],
    { cwd: new URL('../../..', import.meta.url).pathname, stdio: 'ignore' },
  );
}

export const test = base.extend<{ freshBuckets: void }>({
  freshBuckets: [
    // Playwright requires the destructuring pattern even when no fixture is used.
    // eslint-disable-next-line no-empty-pattern
    async ({}, run) => {
      resetRateLimits();
      await run();
    },
    { auto: true },
  ],
  // Every spec is the Content-Security-Policy's test: a violation reported on any page, in the
  // console or as a `securitypolicyviolation` event, fails it.
  page: async ({ page }, run) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (/Content[- ]Security[- ]Policy|CSP-VIOLATION/i.test(text)) violations.push(text);
    });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) =>
        console.error(`CSP-VIOLATION ${event.violatedDirective} ${event.blockedURI}`),
      );
    });
    await run(page);
    expect(violations, 'Content-Security-Policy violations').toEqual([]);
  },
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

/** A stored cart (`{ v: 1, lines }`) for specs that need one without clicking through the menu. */
export function storedCart(lines: { productId: string; quantity: number; name?: string }[]) {
  return JSON.stringify({
    v: 1,
    lines: lines.map(({ productId, quantity, name = 'Test drink' }) => ({
      key: `${productId}|S|`,
      productId,
      categoryId: 'c',
      noPhoto: 0,
      name: { en: name, vi: name },
      imageUrl: null,
      size: 'S',
      basePriceVnd: 29_000,
      sizeDeltaVnd: 0,
      toppings: [],
      quantity,
    })),
  });
}

async function tokenFor(email: string): Promise<string> {
  const { body } = await api<{ data: { accessToken: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: seedPassword() }),
  });
  return body.data.accessToken;
}

export const staffToken = () => tokenFor('staff@brewlite.test');

/** The public menu, as the API serves it — what the page must show, in the order it must show it. */
export async function publicMenu() {
  const categories = await api<{ data: { id: string; name: { en: string; vi: string } }[] }>(
    '/categories',
  );
  const products = await api<{
    data: {
      id: string;
      categoryId: string;
      name: { en: string; vi: string };
      fromPriceVnd: number;
      isSoldOut: boolean;
      imageUrl: string | null;
    }[];
  }>('/products');
  return { categories: categories.body.data, products: products.body.data };
}

export interface ProductDetail {
  id: string;
  name: { en: string; vi: string };
  basePriceVnd: number;
  isSoldOut: boolean;
  sizes: { size: string; priceDeltaVnd: number }[];
  toppings: { id: string; name: { en: string; vi: string }; priceVnd: number }[];
  maxToppings: number;
}

export async function productDetail(id: string): Promise<ProductDetail> {
  const { body } = await api<{ data: ProductDetail }>(`/products/${id}`);
  return body.data;
}

/** Run `body` with a product made unavailable, and put it back whatever happens. */
export async function withSoldOut<T>(productId: string, body: () => Promise<T>): Promise<T> {
  const token = await staffToken();
  const set = (isAvailable: boolean) =>
    api(`/staff/products/${productId}/availability`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ isAvailable }),
    });
  await set(false);
  try {
    return await body();
  } finally {
    await set(true);
  }
}

/** The money format of the English UI: `₫71,000`. */
export const vnd = (amount: number) => `₫${amount.toLocaleString('en-US')}`;

/** The page's scroll position once a smooth scroll has stopped moving. */
export async function settledScrollY(page: Page): Promise<number> {
  let last = -1;
  await expect
    .poll(
      async () => {
        const now = await page.evaluate(() => Math.round(window.scrollY));
        const still = now === last;
        last = now;
        return still;
      },
      { intervals: [150] },
    )
    .toBe(true);
  return last;
}

/** Adds the named drink (smallest size, no toppings) from its product page. */
export async function addDrink(page: Page, name = 'Espresso') {
  const { products } = await publicMenu();
  const product = products.find((p) => p.name.en === name)!;
  await page.goto(`/products/${product.id}`);
  await page.getByRole('button', { name: /^Add to cart/ }).click();
  await expect(page).toHaveURL(/\/$/);
  return product;
}

/**
 * A new customer with a drink in the cart who taps *Place order*: ends on `/orders/[id]`, and
 * returns that id. (The order page starts the payment by itself on arrival.)
 */
export async function placeOrderAsNewCustomer(page: Page, name = 'Espresso') {
  const account = await register(page);
  await addDrink(page, name);
  await page.goto('/checkout');
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  return { ...account, orderId: page.url().split('/').pop()! };
}

/** A customer's access token — setup only. */
export async function userToken(email: string, password = PASSWORD): Promise<string> {
  const { body } = await api<{ data: { accessToken: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return body.data.accessToken;
}

/** The counter moving an order along (`PREPARING` → `READY` → `COMPLETED`). */
export async function advance(orderId: string, to: 'PREPARING' | 'READY' | 'COMPLETED') {
  const { status } = await api(`/staff/orders/${orderId}/status`, {
    method: 'POST',
    token: await staffToken(),
    body: JSON.stringify({ to }),
  });
  expect(status).toBe(200);
}

/**
 * Whether the payment service is the fake provider — the payment specs only make sense then.
 * Waits for the frame to settle on one provider (the page starts the payment by itself).
 */
export async function fakeProviderIsOn(page: Page): Promise<boolean> {
  const fake = page.getByRole('button', { name: 'Simulate success' });
  const other = page.getByText(/Secure · Stripe|unavailable right now|aren.t set up/).first();
  await fake.or(other).waitFor({ timeout: 15_000 });
  return fake.isVisible();
}
