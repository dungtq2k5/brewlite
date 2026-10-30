import { expect, test } from '@playwright/test';

const CART_KEY = 'brewlite_cart';
const CART_ITEM = {
  id: 'e2e-latte-M-',
  productId: 'e2e-latte',
  name: { vi: 'Latte', en: 'Latte' },
  size: 'M',
  toppingIds: [],
  toppingNames: [],
  qty: 2,
  basePriceVnd: 45_000,
  sizeDeltaVnd: 0,
  toppingsPriceVnd: 0,
};

test.describe('customer hardening', () => {
  test('a second tab adopts a cart written by the first tab', async ({ context, page }) => {
    // Start both tabs from a known empty cart without depending on shop data.
    await context.addInitScript((key) => localStorage.removeItem(key), CART_KEY);
    await page.goto('/');
    const other = await context.newPage();
    await other.goto('/');

    const badge = page.locator('.buyer-nav .cart-count');
    await expect(badge).toHaveCount(0);

    await other.evaluate(
      ({ key, item }) => {
        localStorage.setItem(key, JSON.stringify([item]));
      },
      { key: CART_KEY, item: CART_ITEM },
    );

    // The first tab must react to the storage event without a reload.
    await expect(badge).toHaveText('2');

    await other.evaluate((key) => {
      localStorage.setItem(key, JSON.stringify([]));
    }, CART_KEY);
    await expect(badge).toHaveCount(0);
  });

  test('the offline overlay takes focus and keeps Tab inside', async ({ context, page }) => {
    await page.goto('/');
    await context.setOffline(true);

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();

    const retry = dialog.getByRole('button', { name: 'Thử lại' });
    await expect(retry).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(retry).toBeFocused();

    await context.setOffline(false);
    await expect(dialog).toHaveCount(0);
  });
});
