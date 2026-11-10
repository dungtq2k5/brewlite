import { expect, test } from '@playwright/test';

// The smoke run's journey (product-overview J1), against any running stack — so it uses only the
// web app and the public gateway API: no Redis, no docker, no seeded customer. It leaves one
// account and one order under `smoke.brewlite.test`, by design, so a deployed run is easy to spot.

const API = `${(process.env.SMOKE_API_URL ?? 'http://localhost:23100').replace(/\/+$/, '')}/api/v1`;
const STAFF = {
  email: process.env.SMOKE_STAFF_EMAIL ?? 'staff@brewlite.test',
  password: process.env.SMOKE_STAFF_PASSWORD ?? process.env.SEED_ACCOUNT_PASSWORD ?? '',
};

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function staffToken(): Promise<string> {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(STAFF),
  });
  expect(response.status, `staff sign-in as ${STAFF.email}`).toBe(200);
  return ((await response.json()) as { data: { accessToken: string } }).data.accessToken;
}

test('J1 — a guest orders, signs up, pays, and the counter takes it to collected', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem('bl_install_dismissed', '1'));

  await test.step('a guest adds an available drink from the menu', async () => {
    await page.goto('/');
    // The first card without *Sold out* — picked from the page, never by name.
    const card = page
      .locator('main a[href^="/products/"]')
      .filter({ hasNotText: 'Sold out' })
      .first();
    await card.click();
    await page.getByRole('button', { name: /^Add to cart/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  await test.step('checking out asks to sign in; a new account comes back to checkout', async () => {
    await page.goto('/cart');
    await page.getByRole('link', { name: 'Sign in to check out' }).click();
    await page.getByRole('link', { name: 'Create an account' }).click();
    await page.getByLabel('Full name').fill('Smoke Test');
    await page.getByLabel('Email').fill(`smoke-${Date.now()}@smoke.brewlite.test`);
    await page.getByLabel('Password', { exact: true }).fill(`smoke-${Date.now()}-pw`);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/checkout$/);
  });

  await test.step('placing the order opens its page', async () => {
    await page.getByRole('button', { name: /^Place order · / }).click();
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  });

  const fake = page.getByRole('button', { name: 'Simulate success' });
  const stripe = page.getByText(/Secure · Stripe/);
  const notSetUp = page.getByText(/Card payments aren.t set up/);
  let onStripe = false;
  await test.step('the payment form is mounted', async () => {
    await expect(fake.or(stripe).or(notSetUp).first()).toBeVisible({ timeout: 20_000 });
    // Payment runs Stripe but the web app was built without its publishable key — a broken
    // deployment, not a pass.
    expect(
      await notSetUp.isVisible(),
      'the web app was built without NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    ).toBe(false);
    onStripe = !(await fake.isVisible());
  });
  if (onStripe) {
    test.info().annotations.push({
      type: 'payment not completed — Stripe',
      description:
        "Stripe's form is mounted; a script cannot pay with a card, so the run ends here.",
    });
    return;
  }

  await test.step('the fake provider pays it', async () => {
    await fake.click();
    await expect(page.getByRole('heading', { name: "Paid — we've got it." })).toBeVisible();
  });

  await test.step('the counter moves it; the page follows live, without a reload', async () => {
    const orderId = page.url().split('/').pop()!;
    const token = await staffToken();
    for (const [to, heading] of [
      ['PREPARING', 'Brewing'],
      ['READY', 'Ready — collect now'],
      ['COMPLETED', 'Collected — enjoy!'],
    ] as const) {
      const response = await fetch(`${API}/staff/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to }),
      });
      expect(response.status, `move to ${to}`).toBe(200);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 15_000 });
    }
  });
});
