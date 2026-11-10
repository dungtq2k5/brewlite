import { newId } from '@brewlite/contracts';
import type { Page } from '@playwright/test';
import {
  api,
  createAccount,
  expect,
  PASSWORD,
  pickProduct,
  signIn,
  storedCart,
  test,
  userToken,
} from './support';

// Points at checkout (ADR 0035, D06). Fake provider only — skipped on Stripe. Every test makes
// its own customer and earns its points the honest way: one paid order of ₫200,000 or more.

interface Earned {
  email: string;
  token: string;
  balance: number;
  product: Awaited<ReturnType<typeof pickProduct>>;
}

/** A new customer whose first order (paid with the fake provider) earned them points. */
async function customerWithPoints(): Promise<Earned | null> {
  const product = await pickProduct({ sizes: ['S'] });
  const price = product.basePriceVnd + product.sizes.find((s) => s.size === 'S')!.priceDeltaVnd;
  const qty = Math.min(10, Math.ceil(200_000 / price));
  const { email } = await createAccount();
  const token = await userToken(email);
  const placed = await api<{ data: { id: string } }>('/orders', {
    method: 'POST',
    token,
    headers: { 'Idempotency-Key': newId() },
    body: JSON.stringify({ items: [{ productId: product.id, size: 'S', toppingIds: [], qty }] }),
  });
  expect(placed.status).toBe(201);
  const payment = await api<{ data: { id: string; provider: string } }>('/payments', {
    method: 'POST',
    token,
    headers: { 'Idempotency-Key': newId() },
    body: JSON.stringify({ orderId: placed.body.data.id }),
  });
  if (payment.body.data?.provider !== 'FAKE') return null;
  await api(`/payments/${payment.body.data.id}/fake-confirm`, {
    method: 'POST',
    token,
    body: JSON.stringify({ outcome: 'SUCCEEDED' }),
  });
  let balance = 0;
  await expect
    .poll(async () => {
      balance = (await api<{ data: { balance: number } }>('/loyalty/me', { token })).body.data
        .balance;
      return balance;
    })
    .toBeGreaterThan(0);
  return { email, token, balance, product };
}

async function atCheckout(page: Page, earned: Earned, quantity: number) {
  await page.addInitScript(
    (cart) => {
      localStorage.setItem('bl_install_dismissed', '1');
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('bl_cart', cart);
        sessionStorage.setItem('seeded', '1');
      }
    },
    storedCart([{ productId: earned.product.id, quantity }]),
  );
  await signIn(page, earned.email, PASSWORD);
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
  await page.goto('/checkout');
  await expect(page.getByRole('switch', { name: /^Use points, \d+ available$/ })).toBeVisible();
}

const balanceOf = async (token: string) =>
  (await api<{ data: { balance: number } }>('/loyalty/me', { token })).body.data.balance;

test('a customer with no points sees no points control', async ({ page }) => {
  const product = await pickProduct({ sizes: ['S'] });
  const { email } = await createAccount();
  await page.addInitScript(
    (cart) => localStorage.setItem('bl_cart', cart),
    storedCart([{ productId: product.id, quantity: 1 }]),
  );
  await signIn(page, email, PASSWORD);
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
  await page.goto('/checkout');
  await expect(page.getByRole('button', { name: /^Place order · / })).toBeVisible();
  await expect(page.getByRole('switch', { name: /^Use points/ })).toHaveCount(0);
});

test('use all, then fewer: the total and the earn line follow; placing spends them; cancelling returns them', async ({
  page,
}) => {
  const earned = await customerWithPoints();
  test.skip(!earned, 'payment runs with Stripe, not the fake provider');
  const { balance, token } = earned!;
  await atCheckout(page, earned!, 10); // a big cart: the balance, not 50 %, is the limit

  await page.getByRole('switch', { name: /^Use points/ }).check();
  await expect(page.getByText(`Using ${balance} points`, { exact: false })).toBeVisible();
  await expect(page.getByText("That's all your points.")).toBeVisible();
  await expect(page.getByText(`Points · ${balance}`)).toBeVisible();
  await expect(
    page.getByText("Points are taken when you place the order and come back if it's cancelled."),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Use fewer' }).click();
  await page.getByRole('button', { name: 'One point fewer' }).click();
  await expect(page.getByText(`Points · ${balance - 1}`)).toBeVisible();
  await expect(page.getByText("That's all your points.")).toHaveCount(0);

  await page.getByRole('button', { name: /^Place order · / }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  expect(await balanceOf(token)).toBe(1);

  const orderId = page.url().split('/').pop()!;
  expect((await api(`/orders/${orderId}/cancel`, { method: 'POST', token })).status).toBe(200);
  await page.reload();
  await expect(page.getByText(`${balance - 1} points returned to your balance.`)).toBeVisible();
  expect(await balanceOf(token)).toBe(balance);
});

test('a small cart is capped at half its subtotal, and says so', async ({ page }) => {
  const earned = await customerWithPoints();
  test.skip(!earned, 'payment runs with Stripe, not the fake provider');
  await atCheckout(page, earned!, 1);
  await page.getByRole('switch', { name: /^Use points/ }).check();
  await expect(
    page
      .getByText('Up to 50% of your order can be paid with points.')
      .or(page.getByText(/Points can't bring the total below/)),
  ).toBeVisible();
});

test('spent in another tab first: the balance changed, the control resets, the order is placeable', async ({
  page,
}) => {
  const earned = await customerWithPoints();
  test.skip(!earned, 'payment runs with Stripe, not the fake provider');
  await atCheckout(page, earned!, 10);
  await page.getByRole('switch', { name: /^Use points/ }).check();
  await expect(page.getByText(`Using ${earned!.balance} points`, { exact: false })).toBeVisible();

  // Another tab spends them all.
  const spent = await api('/orders', {
    method: 'POST',
    token: earned!.token,
    headers: { 'Idempotency-Key': newId() },
    body: JSON.stringify({
      items: [{ productId: earned!.product.id, size: 'S', toppingIds: [], qty: 10 }],
      pointsToRedeem: earned!.balance,
    }),
  });
  expect(spent.status).toBe(201);

  await page.getByRole('button', { name: /^Place order · / }).click();
  await expect(page.getByText('Your balance changed — you now have 0 points.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Place order · / })).toBeEnabled();
});
