import type { Page } from '@playwright/test';
import { expect, publicMenu, register, test } from '../support';
import { cartOf, heroDismissed, holdFiveSecondTimers, seeded, vietnamese, withCart } from './data';
import { look } from './look';

// Customer — product and cart (D03). Each row follows its frame's *Reach* annotation.
test.beforeEach(async ({ page, baseURL }) => {
  await page.addInitScript(() => localStorage.setItem('bl_install_dismissed', '1'));
  await heroDismissed(page.context(), baseURL!);
});

const productHeading = (page: Page, name: string) =>
  expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
const topping = (page: Page, name: string) =>
  page.getByRole('checkbox', { name: new RegExp(name) });

test('customer-product-default', async ({ page }) => {
  const tea = await seeded('Peach orange lemongrass tea');
  await page.goto(`/products/${tea.id}`);
  await productHeading(page, tea.name.en);
  await expect(page.getByRole('button', { name: /^Add to cart/ })).toBeEnabled();
  await look(page, 'customer-product-default');
});

test('customer-product-two-toppings', async ({ page }) => {
  const tea = await seeded('Peach orange lemongrass tea');
  await page.goto(`/products/${tea.id}`);
  for (const t of tea.toppings.slice(0, 2)) await topping(page, t.name.en).check({ force: true });
  await expect(page.getByText(/^2 of \d chosen$/)).toBeVisible();
  await look(page, 'customer-product-two-toppings');
});

test('customer-product-two-toppings-vi', async ({ page, baseURL }) => {
  await vietnamese(page.context(), baseURL!);
  const tea = await seeded('Peach orange lemongrass tea');
  await page.goto(`/products/${tea.id}`);
  await productHeading(page, tea.name.vi);
  for (const t of tea.toppings.slice(0, 2)) await topping(page, t.name.vi).check({ force: true });
  await look(page, 'customer-product-two-toppings-vi');
});

test('customer-product-topping-limit', async ({ page }) => {
  const tea = await seeded('Peach orange lemongrass tea');
  await page.goto(`/products/${tea.id}`);
  for (const t of tea.toppings.slice(0, 3)) await topping(page, t.name.en).check({ force: true });
  await expect(page.getByText(/^3 of 3 chosen$/)).toBeVisible();
  await look(page, 'customer-product-topping-limit');
});

test('customer-product-sold-out', async ({ page }) => {
  const smoothie = await seeded('Avocado smoothie'); // switched off by the seed
  await page.goto(`/products/${smoothie.id}`);
  await expect(
    page.getByRole('main').getByText('Sold out for today — back tomorrow.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sold out for today' })).toBeDisabled();
  await look(page, 'customer-product-sold-out');
});

test('customer-product-one-size', async ({ page }) => {
  const croissant = await seeded('Croissant');
  await page.goto(`/products/${croissant.id}`);
  await productHeading(page, croissant.name.en);
  await expect(page.getByRole('main').getByText(/^One size · /)).toBeVisible();
  await look(page, 'customer-product-one-size');
});

test('customer-product-quantity-max', async ({ page }) => {
  const tea = await seeded('Peach orange lemongrass tea');
  await page.goto(`/products/${tea.id}`);
  const more = page.getByRole('button', { name: /^Increase quantity/ });
  for (let i = 0; i < 9; i++) await more.click();
  await expect(more).toBeDisabled();
  await expect(page.getByText('10 is the most per item.')).toBeVisible();
  await look(page, 'customer-product-quantity-max');
});

test('customer-product-cart-full', async ({ page }) => {
  await withCart(page, await cartOf(20));
  // A combination the 20 lines don't have: a product past the first 20 available, or the tea in L.
  const { products } = await publicMenu();
  const outside = products.filter((p) => !p.isSoldOut)[20];
  const target = outside
    ? await seeded(outside.name.en)
    : await seeded('Peach orange lemongrass tea');
  await page.goto(`/products/${target.id}`);
  if (!outside) await page.getByRole('radio', { name: /^L · Large/ }).check({ force: true });
  await expect(
    page.getByText(
      'Your cart is full — 20 different drinks is the most. Check out or remove one first.',
    ),
  ).toBeVisible();
  await look(page, 'customer-product-cart-full');
});

test('customer-product-not-found', async ({ page }) => {
  // Both an unknown id and a malformed one are "not on the menu"; the frame is drawn once.
  await page.goto('/products/nope');
  await expect(
    page.getByRole('heading', { name: "This item isn't on the menu any more" }),
  ).toBeVisible();
  await page.goto('/products/01a0e67a-33af-7000-8000-000000000000');
  await expect(
    page.getByRole('heading', { name: "This item isn't on the menu any more" }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to menu' })).toBeVisible();
  await look(page, 'customer-product-not-found');
});

test('customer-cart-empty', async ({ page }) => {
  await page.goto('/cart');
  await expect(page.getByText('Nothing here yet — what are you craving?')).toBeVisible();
  await look(page, 'customer-cart-empty');
});

test('customer-cart-guest', async ({ page }) => {
  await withCart(page, await cartOf(1));
  await page.goto('/cart');
  await expect(page.getByRole('link', { name: /Sign in to check out|Check out/ })).toBeVisible();
  await look(page, 'customer-cart-guest');
});

test('customer-cart-signed-in', async ({ page }) => {
  await register(page);
  await withCart(page, await cartOf(3));
  await page.goto('/cart');
  await expect(page.getByRole('link', { name: 'Check out' })).toBeVisible();
  await look(page, 'customer-cart-signed-in');
});

test('customer-cart-signed-in-vi', async ({ page, baseURL }) => {
  await register(page);
  await vietnamese(page.context(), baseURL!);
  await withCart(page, await cartOf(3));
  await page.goto('/cart');
  await expect(page.getByRole('heading', { level: 1, name: 'Giỏ hàng' })).toBeVisible();
  await look(page, 'customer-cart-signed-in-vi');
});

test('customer-cart-full', async ({ page }) => {
  await register(page);
  await withCart(page, await cartOf(20));
  await page.goto('/cart');
  // The longest cart: the list scrolls under the sticky summary; Check out never leaves the screen.
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(20);
  await expect(page.getByRole('link', { name: 'Check out' })).toBeInViewport();
  await look(page, 'customer-cart-full');
});

test('customer-cart-undo', async ({ page }) => {
  await register(page);
  await withCart(page, await cartOf(2, [10, 1]));
  // The Undo row lasts 5 s; held, so the checks and the drawing can't outlast it.
  await holdFiveSecondTimers(page);
  await page.goto('/cart');
  const removed = (await page
    .getByRole('button', { name: /^Remove / })
    .nth(1)
    .getAttribute('aria-label'))!;
  await page.getByRole('button', { name: removed }).click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  await look(page, 'customer-cart-undo');
});
