import { expect, fakeProviderIsOn, placeOrderAsNewCustomer, register, test } from './support';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bl_install_dismissed', '1'));
});

test("a new customer's history is empty and points to the menu", async ({ page }) => {
  await register(page);
  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: 'My orders', level: 1 })).toBeVisible();
  await expect(page.getByText('No orders yet — your first one is a few taps away.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse the menu' })).toBeVisible();
});

test('a placed order is a row that opens its page', async ({ page }) => {
  const { orderId } = await placeOrderAsNewCustomer(page);
  await page.goto('/orders');
  const row = page.getByRole('link', { name: /^Order #\d+$/ });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Espresso');
  await expect(row).toContainText('Awaiting payment');
  await row.click();
  await expect(page).toHaveURL(new RegExp(orderId));
});

test('the account shows the name, lets it change, and says how the customer signs in', async ({
  page,
}) => {
  await register(page, undefined, 'Lan Anh');
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Account', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute('readonly', '');
  await expect(page.getByText('Email and password')).toBeVisible();
  await expect(page.getByText('No points yet — your first paid order starts them.')).toBeVisible();

  const save = page.getByRole('button', { name: 'Save changes' });
  await expect(save).toBeDisabled();
  await page.getByLabel('Full name').fill('Minh Chau');
  await save.click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Full name')).toHaveValue('Minh Chau');
});

test('points appear in the ledger once an order is paid', async ({ page }) => {
  const { orderId } = await placeOrderAsNewCustomer(page, 'Iced milk coffee');
  test.skip(!(await fakeProviderIsOn(page)), 'payment runs with Stripe, not the fake provider');
  await page.getByRole('button', { name: 'Simulate success' }).click();
  await expect(page.getByRole('heading', { name: "Paid — we've got it." })).toBeVisible();

  await expect
    .poll(
      async () => {
        await page.goto('/account');
        return page.getByRole('link', { name: /Earned on order/ }).count();
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
  await page
    .getByRole('link', { name: /Earned on order/ })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(orderId));
});
