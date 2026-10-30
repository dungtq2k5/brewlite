import type { Page } from '@playwright/test';
import { expect, publicMenu, register, storedCart, test, vnd } from './support';

async function addFromMenu(page: Page, name: string, options: { size?: RegExp } = {}) {
  const { products } = await publicMenu();
  const product = products.find((p) => p.name.en === name)!;
  await page.goto(`/products/${product.id}`);
  if (options.size) await page.getByRole('radio', { name: options.size }).check({ force: true });
  await page.getByRole('button', { name: /^Add to cart/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

const cartLines = (page: Page) =>
  page.getByRole('listitem').filter({ has: page.getByRole('button', { name: /^(Remove|Bỏ) / }) });

test('the same drink twice merges; another size is its own line; the total follows', async ({
  page,
}) => {
  await addFromMenu(page, 'Iced milk coffee');
  await addFromMenu(page, 'Iced milk coffee');
  await addFromMenu(page, 'Iced milk coffee', { size: /^L · Large/ });
  await page.goto('/cart');

  await expect(cartLines(page)).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Your cart', level: 1 })).toBeVisible();
  await expect(page.getByText('3 items').first()).toBeVisible();
  await expect(cartLines(page).first().getByRole('status')).toHaveText('2');

  const total = page.getByText(/^Total · 3 items$/);
  await expect(total).toBeVisible();
  await cartLines(page)
    .first()
    .getByRole('button', { name: /^Increase quantity/ })
    .click();
  await expect(page.getByText(/^Total · 4 items$/)).toBeVisible();
});

test('Remove is instant and Undo puts the line back in its place', async ({ page }) => {
  await addFromMenu(page, 'Espresso');
  await addFromMenu(page, 'Americano');
  await page.goto('/cart');
  await expect(cartLines(page)).toHaveCount(2);

  await page.getByRole('button', { name: 'Remove Espresso' }).click();
  await expect(cartLines(page)).toHaveCount(1);
  await expect(page.getByText('Removed Espresso')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(cartLines(page)).toHaveCount(2);
  await expect(cartLines(page).first()).toContainText('Espresso');
});

test('the Undo row lasts five seconds', async ({ page }) => {
  await addFromMenu(page, 'Espresso');
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Remove Espresso' }).click();
  await expect(page.getByText('Removed Espresso')).toBeVisible();
  await expect(page.getByText('Removed Espresso')).toBeHidden({ timeout: 8000 });
  await expect(page.getByText('Nothing here yet — what are you craving?')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse the menu' })).toBeVisible();
});

test('an empty cart says so', async ({ page }) => {
  await page.goto('/cart');
  await expect(page.getByText('Nothing here yet — what are you craving?')).toBeVisible();
});

test('the cart survives a reload, a language switch and signing in', async ({ page }) => {
  await addFromMenu(page, 'Espresso');
  await page.goto('/cart');
  await expect(cartLines(page)).toHaveCount(1);
  await page.reload();
  await expect(cartLines(page)).toHaveCount(1);

  await page.getByRole('button', { name: 'Tiếng Việt' }).click();
  await expect(page.getByRole('heading', { name: 'Giỏ hàng', level: 1 })).toBeVisible();
  await expect(cartLines(page)).toHaveCount(1);
  await expect(cartLines(page).first()).toContainText('Espresso'); // the seed names it Espresso in both

  await page.getByRole('button', { name: 'English' }).click(); // the form below is in English
  await expect(page.getByRole('heading', { name: 'Your cart', level: 1 })).toBeVisible();
  await register(page);
  await page.goto('/cart');
  await expect(cartLines(page)).toHaveCount(1);
});

test('sign-out clears the cart', async ({ page }) => {
  await register(page);
  await addFromMenu(page, 'Espresso');
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page
    .getByRole('dialog', { name: 'Account' })
    .getByRole('button', { name: 'Sign out' })
    .click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await page.goto('/cart');
  await expect(page.getByText('Nothing here yet — what are you craving?')).toBeVisible();
});

test('a guest checks out through sign-in and comes back with the cart intact', async ({ page }) => {
  const { email, password } = await register(page);
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page
    .getByRole('dialog', { name: 'Account' })
    .getByRole('button', { name: 'Sign out' })
    .click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

  await addFromMenu(page, 'Espresso');
  await page.goto('/cart');
  await page.getByRole('link', { name: 'Sign in to check out' }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout$/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  const stored = await page.evaluate(() => localStorage.getItem('bl_cart'));
  expect(JSON.parse(stored!).lines).toHaveLength(1);
});

test('a signed-in customer sees "Check out"', async ({ page }) => {
  await register(page);
  await addFromMenu(page, 'Espresso');
  await page.goto('/cart');
  await expect(page.getByRole('link', { name: 'Check out' })).toHaveAttribute('href', '/checkout');
});

test.describe('the 20-line limit', () => {
  test.beforeEach(async ({ page }) => {
    // 19 lines for drinks that do not exist, plus Iced milk coffee in S: 20 distinct lines.
    const { products } = await publicMenu();
    const coffee = products.find((p) => p.name.en === 'Iced milk coffee')!;
    const lines = Array.from({ length: 19 }, (_, i) => ({ productId: `fake-${i}`, quantity: 1 }));
    await page.goto('/');
    await page.evaluate(
      (cart) => localStorage.setItem('bl_cart', cart),
      storedCart([...lines, { productId: coffee.id, quantity: 1, name: 'Iced milk coffee' }]),
    );
  });

  test('a new combination is refused before the tap; a matching line is not', async ({ page }) => {
    const { products } = await publicMenu();
    const espresso = products.find((p) => p.name.en === 'Espresso')!;
    await page.goto(`/products/${espresso.id}`);
    await expect(
      page.getByText(
        'Your cart is full — 20 different drinks is the most. Check out or remove one first.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^Add to cart/ })).toBeDisabled();

    const coffee = products.find((p) => p.name.en === 'Iced milk coffee')!;
    await page.goto(`/products/${coffee.id}`);
    await expect(page.getByRole('button', { name: /^Add to cart/ })).toBeEnabled(); // same line: only raises it
    await page.getByRole('radio', { name: /^L · Large/ }).check({ force: true });
    await expect(page.getByRole('button', { name: /^Add to cart/ })).toBeDisabled(); // a new line
    await page.getByRole('radio', { name: /^S · Small/ }).check({ force: true });
    await expect(page.getByRole('button', { name: /^Add to cart/ })).toBeEnabled();
  });

  test('the cart page counts lines and items separately', async ({ page }) => {
    await page.goto('/cart');
    await expect(cartLines(page)).toHaveCount(20);
    await expect(page.getByText('20 items').first()).toBeVisible();
    await expect(page.getByText(vnd(29_000 * 20)).first()).toBeVisible();
  });
});

test('a corrupt stored cart is an empty cart, not a broken page', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('bl_cart', '{"v":9,"lines":"nope"}'));
  await page.goto('/cart');
  await expect(page.getByText('Nothing here yet — what are you craving?')).toBeVisible();
});
