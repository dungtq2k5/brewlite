import { expect, test as base, type Browser, type Page } from '@playwright/test';
import {
  fakeProviderIsOn,
  payWithFake,
  placeOrderAsNewCustomer,
  seedPassword,
  signIn,
  test,
} from './support';

void base;

async function adminOn(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await signIn(page, 'admin@brewlite.test', seedPassword());
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
  return page;
}

const todayOrders = async (admin: Page) => {
  await admin.goto('/admin');
  const tile = admin.getByText('Today · orders').locator('..');
  return Number(await tile.locator('span').nth(1).innerText());
};

test('today’s orders grow by one after a paid order', async ({ page, browser }) => {
  const admin = await adminOn(browser);
  const before = await todayOrders(admin);
  await placeOrderAsNewCustomer(page);
  test.skip(!(await fakeProviderIsOn(page)), 'payment runs with Stripe, not the fake provider');
  await payWithFake(page);
  expect(await todayOrders(admin)).toBe(before + 1);
  await admin.context().close();
});

test('the presets move the range; a range over 93 days sends nothing and says so', async ({
  browser,
}) => {
  const admin = await adminOn(browser);
  await admin.goto('/admin');
  await expect(admin.getByRole('heading', { level: 1 })).toContainText(
    /^Good (morning|afternoon|evening)/,
  );
  await expect(admin.getByRole('table', { name: 'Per day' }).locator('tbody tr')).toHaveCount(7);
  await admin.getByRole('link', { name: '30 days' }).click();
  await expect(admin).toHaveURL(/range=30d/);
  await expect(admin.getByRole('table', { name: 'Per day' }).locator('tbody tr')).toHaveCount(30);

  await admin.goto('/admin?range=custom&from=2026-01-01&to=2026-06-01');
  await expect(admin.getByText(/That range is \d+ days — choose 93 days or fewer\./)).toBeVisible();
  await expect(admin.getByLabel('From')).toHaveAttribute('aria-invalid', 'true');
  await expect(admin.getByLabel('To')).toHaveAttribute('aria-invalid', 'true');
  await expect(admin.getByRole('table', { name: 'Per day' })).toHaveCount(0);
  await admin.context().close();
});
