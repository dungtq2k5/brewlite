import { advance, expect, fakeProviderIsOn, placeOrderAsNewCustomer, test } from './support';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bl_install_dismissed', '1'));
});

async function paidOrder(page: Parameters<typeof placeOrderAsNewCustomer>[0]) {
  const placed = await placeOrderAsNewCustomer(page);
  test.skip(!(await fakeProviderIsOn(page)), 'payment runs with Stripe, not the fake provider');
  await page.getByRole('button', { name: 'Simulate success' }).click();
  await expect(page.getByRole('heading', { name: "Paid — we've got it." })).toBeVisible();
  return placed;
}

test('the page follows the order from Paid to Collected without a reload', async ({ page }) => {
  const { orderId } = await paidOrder(page);
  await expect(page.getByText('Live', { exact: true })).toBeVisible();

  await advance(orderId, 'PREPARING');
  await expect(page.getByRole('heading', { name: 'Brewing' })).toBeVisible();

  await advance(orderId, 'READY');
  await expect(page.getByRole('alert').filter({ hasText: 'is ready' })).toBeVisible();
  await expect(page).toHaveTitle(/^● Ready · #\d+ — BrewLite$/);

  await advance(orderId, 'COMPLETED');
  await expect(page.getByRole('heading', { name: 'Collected — enjoy!' })).toBeVisible();
  await expect(page).not.toHaveTitle(/Ready/);
  await expect(
    page.getByRole('list', { name: /Progress/ }).or(page.getByText('Progress')),
  ).toBeVisible();
});

test('a finished order opens no stream and the browser does not reconnect', async ({ page }) => {
  const { orderId } = await paidOrder(page);
  await advance(orderId, 'PREPARING');
  await advance(orderId, 'READY');
  await advance(orderId, 'COMPLETED');

  const streams: string[] = [];
  page.on('request', (r) => r.url().includes('/api/events/') && streams.push(r.url()));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Collected — enjoy!' })).toBeVisible();
  await page.waitForTimeout(5000);
  expect(streams).toEqual([]);
});

test("someone else's order is just not found", async ({ page }) => {
  const { orderId } = await paidOrder(page);
  const other = await page.context().browser()!.newContext();
  const otherPage = await other.newPage();
  const { register } = await import('./support');
  await register(otherPage);
  await otherPage.goto(`/orders/${orderId}`);
  await expect(otherPage.getByRole('heading', { name: "We can't find this order" })).toBeVisible();
  await other.close();
});

test('the stream route answers 404 to a malformed id and streams to the owner', async ({
  page,
}) => {
  const { orderId } = await paidOrder(page);
  const response = await page.request
    .get(`/api/events/orders/${orderId}`, { failOnStatusCode: false, timeout: 3000 })
    .catch(() => null);
  // Our own order streams (the request stays open and is aborted by the timeout above).
  expect(response === null || response.status() === 200).toBe(true);
  const missing = await page.request.get('/api/events/orders/not-an-id', {
    failOnStatusCode: false,
  });
  expect(missing.status()).toBe(404);
});
