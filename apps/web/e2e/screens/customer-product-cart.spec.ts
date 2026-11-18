import type { Page } from '@playwright/test';
import { expect, register, test } from '../support';
import {
  cartLines,
  fillCart,
  heroDismissed,
  holdFiveSecondTimers,
  seeded,
  vietnamese,
  withCart,
  type LineSpec,
} from './data';
import { look } from './look';

// Customer — product and cart (D03). Each row follows its frame's *Reach* annotation.
test.beforeEach(async ({ page, baseURL }) => {
  await page.addInitScript(() => localStorage.setItem('bl_install_dismissed', '1'));
  await heroDismissed(page.context(), baseURL!);
});

const productHeading = (page: Page, name: string) =>
  expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
// The inputs are `sr-only` and the sticky add bar can cover a row, so rows dispatch the click.
const topping = (page: Page, name: string) =>
  page.getByRole('checkbox', { name: new RegExp(name) });

// The lines the cart frames draw (D03).
const BROWN_SUGAR: LineSpec = {
  product: 'Brown sugar milk tea',
  size: 'M',
  toppings: ['Black tapioca pearls', 'Cheese foam'],
};
const ICED_MILK: LineSpec = { product: 'Iced milk coffee', size: 'S' };
const PEACH: LineSpec = {
  product: 'Peach orange lemongrass tea',
  size: 'L',
  toppings: ['Peach slices'],
};

test('customer-product-default', async ({ page }) => {
  const tea = await seeded('Brown sugar milk tea');
  await page.goto(`/products/${tea.id}`);
  await productHeading(page, tea.name.en);
  await expect(page.getByRole('button', { name: /^Add to cart/ })).toBeEnabled();
  await look(page, 'customer-product-default');
});

test('customer-product-two-toppings', async ({ page }) => {
  const tea = await seeded('Brown sugar milk tea');
  await page.goto(`/products/${tea.id}`);
  for (const t of ['Black tapioca pearls', 'Cheese foam'])
    await topping(page, t).dispatchEvent('click');
  await expect(page.getByText(/^2 of \d chosen$/)).toBeVisible();
  await look(page, 'customer-product-two-toppings');
});

test('customer-product-two-toppings-vi', async ({ page, baseURL }) => {
  await vietnamese(page.context(), baseURL!);
  const tea = await seeded('Brown sugar milk tea');
  await page.goto(`/products/${tea.id}`);
  await productHeading(page, tea.name.vi);
  for (const t of ['Trân châu đen', 'Kem phô mai']) await topping(page, t).dispatchEvent('click');
  await look(page, 'customer-product-two-toppings-vi');
});

test('customer-product-topping-limit', async ({ page }) => {
  const tea = await seeded('Brown sugar milk tea');
  await page.goto(`/products/${tea.id}`);
  for (const t of ['Black tapioca pearls', 'Cheese foam', 'Grass jelly'])
    await topping(page, t).dispatchEvent('click');
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
  const coffee = await seeded('Iced milk coffee');
  await page.goto(`/products/${coffee.id}`);
  const more = page.getByRole('button', { name: /^Increase quantity/ });
  for (let i = 0; i < 9; i++) await more.click();
  await expect(more).toBeDisabled();
  await expect(page.getByText('10 is the most per item.')).toBeVisible();
  await look(page, 'customer-product-quantity-max');
});

test('customer-product-cart-full', async ({ page }) => {
  // 20 distinct lines, none of them Iced milk coffee in M — the frame's new combination.
  await withCart(
    page,
    await fillCart([BROWN_SUGAR, ICED_MILK, PEACH], 20, [
      { product: 'Iced milk coffee', size: 'M' },
    ]),
  );
  const coffee = await seeded('Iced milk coffee');
  await page.goto(`/products/${coffee.id}`);
  await page.getByRole('radio', { name: /^M · Medium/ }).dispatchEvent('click');
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
  await withCart(page, await cartLines([{ ...BROWN_SUGAR, quantity: 2 }]));
  await page.goto('/cart');
  await expect(page.getByRole('link', { name: /Sign in to check out|Check out/ })).toBeVisible();
  await look(page, 'customer-cart-guest');
});

test('customer-cart-signed-in', async ({ page }) => {
  await register(page);
  await withCart(page, await cartLines([{ ...BROWN_SUGAR, quantity: 2 }, ICED_MILK, PEACH]));
  await page.goto('/cart');
  await expect(page.getByRole('link', { name: 'Check out' })).toBeVisible();
  await look(page, 'customer-cart-signed-in');
});

test('customer-cart-signed-in-vi', async ({ page, baseURL }) => {
  await register(page);
  await vietnamese(page.context(), baseURL!);
  await withCart(page, await cartLines([{ ...BROWN_SUGAR, quantity: 2 }, ICED_MILK, PEACH]));
  await page.goto('/cart');
  await expect(page.getByRole('heading', { level: 1, name: 'Giỏ hàng' })).toBeVisible();
  await look(page, 'customer-cart-signed-in-vi');
});

test('customer-cart-full', async ({ page }) => {
  await register(page);
  await withCart(page, await fillCart([BROWN_SUGAR, ICED_MILK, PEACH], 20));
  await page.goto('/cart');
  // The longest cart: the list scrolls under the sticky summary; Check out never leaves the screen.
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(20);
  await expect(page.getByRole('link', { name: 'Check out' })).toBeInViewport();
  await look(page, 'customer-cart-full');
});

test('customer-cart-undo', async ({ page }) => {
  await register(page);
  // The frame: Iced milk coffee at 10 (the per-line max), Brown sugar milk tea just removed, the tea.
  await withCart(page, await cartLines([{ ...ICED_MILK, quantity: 10 }, BROWN_SUGAR, PEACH]));
  // The Undo row lasts 5 s; held, so the checks and the drawing can't outlast it.
  await holdFiveSecondTimers(page);
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Remove Brown sugar milk tea' }).click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  await look(page, 'customer-cart-undo');
});
