import { addDrink, expect, placeOrderAsNewCustomer, register, test, withSoldOut } from './support';

test("the checkout shows the server's total and Place order opens the order page", async ({
  page,
}) => {
  await register(page);
  await addDrink(page, 'Espresso');
  await page.goto('/checkout');

  await expect(page.getByRole('heading', { name: 'Checkout', level: 1 })).toBeVisible();
  const place = page.getByRole('button', { name: /^Place order · ₫[\d,]+$/ });
  await expect(place).toBeVisible();
  const label = (await place.textContent())!;
  await place.click();

  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Waiting for payment' })).toBeVisible();
  // The summary on the order page is the same number the button promised.
  await expect(page.getByText(label.replace('Place order · ', '')).first()).toBeVisible();
});

test('a reload of the order page does not start a second payment', async ({ page }) => {
  const { orderId } = await placeOrderAsNewCustomer(page);
  await expect(page.getByRole('heading', { name: /^Pay / })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(new RegExp(orderId));
  await expect(page.getByRole('heading', { name: /^Pay / })).toBeVisible();
});

test('an unavailable drink is named at the checkout and not counted', async ({ page }) => {
  await register(page);
  const product = await addDrink(page, 'Espresso');
  await withSoldOut(product.id, async () => {
    await page.goto('/checkout');
    await expect(page.getByText('Not counted in the total')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Place order/ })).toBeDisabled();
  });
});
