import { expect, fakeProviderIsOn, placeOrderAsNewCustomer, test } from './support';

// These run against the fake provider (the default of `services/payment/.env.example`); with
// Stripe configured the same page shows Stripe\'s form instead, which a browser test cannot drive.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bl_install_dismissed', '1'));
});

test('payment starts on arrival and Simulate success ends in Paid, with the cart emptied', async ({
  page,
}) => {
  await placeOrderAsNewCustomer(page);
  test.skip(!(await fakeProviderIsOn(page)), 'payment runs with Stripe, not the fake provider');

  // The cart is not emptied by placing the order…
  await expect(page.getByRole('link', { name: /^Cart, 1 item/ })).toBeVisible();
  await page.getByRole('button', { name: 'Simulate success' }).click();
  await expect(page.getByText('Confirming your payment…')).toBeVisible();
  // …but by seeing it paid, which the stream brings.
  await expect(page.getByRole('heading', { name: "Paid — we've got it." })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart', exact: true })).toBeVisible();
});

test('Simulate failure lets the customer try again', async ({ page }) => {
  await placeOrderAsNewCustomer(page);
  test.skip(!(await fakeProviderIsOn(page)), 'payment runs with Stripe, not the fake provider');

  await page.getByRole('button', { name: 'Simulate failure' }).click();
  await expect(page.getByText("The payment didn't go through. You weren't charged.")).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Simulate success' })).toBeVisible();
});

test('cancelling an unpaid order keeps the cart', async ({ page }) => {
  await placeOrderAsNewCustomer(page);
  await page.getByRole('button', { name: 'Cancel order' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Cancel this order?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel order' }).last().click();

  await expect(page.getByText('You cancelled this order. Nothing was charged.')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Cart, 1 item/ })).toBeVisible();
});

test('closing the page after paying leaves the waiting state in place', async ({ page }) => {
  await placeOrderAsNewCustomer(page);
  test.skip(!(await fakeProviderIsOn(page)), 'payment runs with Stripe, not the fake provider');
  await page.getByRole('button', { name: 'Simulate success' }).click();
  await expect(page.getByRole('heading', { name: "Paid — we've got it." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: "Paid — we've got it." })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
});
