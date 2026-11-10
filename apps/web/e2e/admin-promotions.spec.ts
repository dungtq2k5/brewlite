import { expect, test as base, type Page } from '@playwright/test';
import { newId } from '@brewlite/contracts';
import {
  adminToken,
  api,
  createAccount,
  pickProduct,
  seedPassword,
  signIn,
  test,
  userToken,
} from './support';

// Desktop frame. A promotion's code can never be reused, so each run makes its own; they stay in
// the *Deleted* list afterwards (`E2E…` tells a human what they are).
test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });
void base;

const code = () => `E2E${newId().replace(/-/g, '').slice(-12).toUpperCase()}`;

async function asAdmin(page: Page) {
  await signIn(page, 'admin@brewlite.test', seedPassword());
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
}

async function create(page: Page, value: string) {
  await page.goto('/admin/promotions/new');
  await page.getByLabel(/^Code/).fill(value);
  await page.getByLabel('Percent', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Create promotion' }).click();
}

test('create, taken, locked fields on edit, limits, switch off, delete and restore', async ({
  page,
}) => {
  const value = code();
  await asAdmin(page);
  await create(page, value);
  await expect(page).toHaveURL(/\/admin\/promotions$/);
  const row = page.getByRole('row', { name: new RegExp(value) });
  await expect(row).toContainText('10% off');
  await expect(row).toContainText('Running');

  await create(page, value);
  await expect(
    page.getByText('This code is already taken (deleted codes count too).'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Leave', exact: true }).click(); // the form is dirty

  await page.getByRole('link', { name: value }).click();
  await expect(page.getByText(/^Locked — orders already used this discount/)).toBeVisible();
  await expect(page.getByLabel(/^Code/)).toHaveCount(0);

  // Per customer starts at 1; empty it (unlimited), set a total, save.
  await page.getByLabel(/^Per customer/).fill('');
  await page.getByLabel(/^Total uses/).fill('5');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Promotion saved')).toBeVisible();
  await page.getByLabel(/^Active/).uncheck();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Promotion saved')).toBeVisible();

  await page.goto('/admin/promotions');
  await expect(page.getByRole('row', { name: new RegExp(value) })).toContainText('Switched off');
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0); // deleting is on the edit page
  await page.getByRole('link', { name: value }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('row', { name: new RegExp(value) })).toHaveCount(0);
  await page.getByRole('button', { name: 'Deleted' }).click();
  await page
    .getByRole('row', { name: new RegExp(value) })
    .getByRole('button', { name: 'Restore' })
    .click();
  await page.getByRole('button', { name: 'Deleted' }).click();
  await expect(page.getByRole('row', { name: new RegExp(value) })).toBeVisible();
});

test('a cap below the uses already made is refused with the count', async ({ page }) => {
  const value = code();
  const token = await adminToken();
  const now = Date.now();
  const made = await api<{ data: { id: string } }>('/admin/promotions', {
    method: 'POST',
    token,
    body: JSON.stringify({
      code: value,
      discountType: 'PERCENT',
      discountValue: 10,
      startsAt: new Date(now - 3_600_000).toISOString(),
      endsAt: new Date(now + 86_400_000).toISOString(),
      maxUses: null,
      perUserLimit: 1,
    }),
  });
  expect(made.status).toBe(201);
  const product = await pickProduct();
  for (let i = 0; i < 2; i += 1) {
    const account = await createAccount();
    const placed = await api('/orders', {
      method: 'POST',
      token: await userToken(account.email),
      headers: { 'Idempotency-Key': newId() },
      body: JSON.stringify({
        items: [{ productId: product.id, size: product.sizes[0]!.size, toppingIds: [], qty: 1 }],
        promoCode: value,
      }),
    });
    expect([200, 201]).toContain(placed.status);
  }
  await asAdmin(page);
  await page.goto(`/admin/promotions/${made.body.data.id}`);
  await page.getByLabel(/^Total uses/).fill('1');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/have already been used — the cap can't be lower/)).toBeVisible();
});
