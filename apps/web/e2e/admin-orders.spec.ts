import { expect, test as base, type Browser, type Page } from '@playwright/test';
import {
  api,
  fakeProviderIsOn,
  orderNoOn,
  payWithFake,
  placeOrderAsNewCustomer,
  seedPassword,
  staffToken,
  statusOf,
  signIn,
  test,
  userToken,
} from './support';

// Fake provider only (like the payment specs): a paid order, then cancelled so the refund shows.
void base;

async function adminOn(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await signIn(page, 'admin@brewlite.test', seedPassword());
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
  return page;
}

test('the list finds an order by number; the detail shows names, payments and the refund', async ({
  page,
  browser,
}) => {
  const placed = await placeOrderAsNewCustomer(page);
  test.skip(!(await fakeProviderIsOn(page)), 'payment runs with Stripe, not the fake provider');
  await payWithFake(page);
  const no = await orderNoOn(page);
  const cancel = await api(`/staff/orders/${placed.orderId}/cancel`, {
    method: 'POST',
    token: await staffToken(),
    body: JSON.stringify({ note: 'Machine broken' }),
  });
  expect(cancel.status).toBe(200);
  const token = await userToken(placed.email, placed.password);
  await expect
    .poll(async () => (await statusOf(placed.orderId, token)).refundStatus)
    .not.toBe('NONE');

  const admin = await adminOn(browser);
  await admin.goto(`/admin/orders?orderNo=${no}`);
  const row = admin.getByRole('row', { name: new RegExp(`#${no}`) });
  await expect(row).toContainText('Lan Anh');
  await expect(row).toContainText('Cancelled');
  await row.getByRole('link', { name: `#${no}` }).click();

  await expect(admin.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  await expect(admin.getByRole('heading', { name: 'Payments' })).toBeVisible();
  await expect(admin.getByText('Succeeded')).toBeVisible();
  await expect(admin.getByRole('heading', { name: 'Refund' })).toBeVisible();
  await expect(admin.getByRole('link', { name: 'Lan Anh' }).first()).toBeVisible();
  await expect(admin.getByRole('main').getByRole('button')).toHaveCount(0); // no actions

  // ?userId= narrows the list to that customer's orders.
  const href = await admin.getByRole('link', { name: 'Lan Anh' }).first().getAttribute('href');
  const userId = href!.split('/').pop();
  await admin.goto(`/admin/orders?userId=${userId}`);
  await expect(admin.getByText('Showing one customer’s orders')).toBeVisible();
  await expect(admin.getByRole('row', { name: new RegExp(`#${no}`) })).toBeVisible();
  await admin.context().close();
});

test('an unknown order id is the not-found page', async ({ browser }) => {
  const admin = await adminOn(browser);
  await admin.goto('/admin/orders/00000000-0000-7000-8000-000000000000');
  await expect(admin.getByRole('heading', { name: 'Order not found.' })).toBeVisible();
  await admin.context().close();
});
