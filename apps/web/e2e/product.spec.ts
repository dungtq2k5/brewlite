import type { Page } from '@playwright/test';
import {
  expect,
  pickProduct,
  settledScrollY,
  test,
  vnd,
  withSoldOut,
  withToppingsOn,
  type PickOptions,
  type ProductDetail,
} from './support';

/** Opens a product picked from the API for what the test needs — never one named in the spec. */
async function openProduct(page: Page, options: PickOptions = {}): Promise<ProductDetail> {
  const detail = await pickProduct(options);
  await page.goto(`/products/${detail.id}`);
  await expect(page.getByRole('heading', { name: detail.name.en, level: 1 })).toBeVisible();
  return detail;
}

const addButton = (page: Page) => page.getByRole('button', { name: /^Add to cart/ });

const SIZE_NAME = { S: 'Small', M: 'Medium', L: 'Large' } as const;
const ORDER = ['S', 'M', 'L'];
const radio = (page: Page, size: string) =>
  page.getByRole('radio', { name: new RegExp(`^${size} · ${SIZE_NAME[size as 'S']}`) });

test('the smallest size is selected and its price is on the button; every tap moves the total', async ({
  page,
}) => {
  const detail = await openProduct(page, { minSizes: 2, toppings: 2 });
  const sizes = [...detail.sizes].sort((a, b) => ORDER.indexOf(a.size) - ORDER.indexOf(b.size));
  const small = sizes[0]!;
  const large = sizes.at(-1)!;
  await expect(radio(page, small.size)).toBeChecked();
  await expect(addButton(page)).toHaveText(
    `Add to cart · ${vnd(detail.basePriceVnd + small.priceDeltaVnd)}`,
  );

  await radio(page, large.size).check({ force: true });
  await expect(addButton(page)).toHaveText(
    `Add to cart · ${vnd(detail.basePriceVnd + large.priceDeltaVnd)}`,
  );

  const [a, b] = detail.toppings;
  await page.getByRole('checkbox', { name: new RegExp(a!.name.en) }).check({ force: true });
  await page.getByRole('checkbox', { name: new RegExp(b!.name.en) }).check({ force: true });
  const unit = detail.basePriceVnd + large.priceDeltaVnd + a!.priceVnd + b!.priceVnd;
  await expect(addButton(page)).toHaveText(`Add to cart · ${vnd(unit)}`);
  await expect(page.getByText('2 of 3 chosen')).toBeVisible();

  await page.getByRole('button', { name: /^Increase quantity/ }).click();
  await expect(addButton(page)).toHaveText(`Add to cart · ${vnd(unit * 2)}`);
});

test('three toppings is the limit: the rest are disabled but focusable, with the line announced', async ({
  page,
}) => {
  // The seed leaves toppings off, so no product shows four: switch the missing ones on for this test.
  await withToppingsOn(4, async (detail) => {
    await page.goto(`/products/${detail.id}`);
    await expect(page.getByRole('heading', { name: detail.name.en, level: 1 })).toBeVisible();
    expect(detail.toppings.length).toBeGreaterThanOrEqual(4);
    const boxes = detail.toppings.map((t) =>
      page.getByRole('checkbox', { name: new RegExp(t.name.en) }),
    );
    for (const box of boxes.slice(0, 3)) await box.check({ force: true });

    const fourth = boxes[3]!;
    await expect(fourth).toHaveAttribute('aria-disabled', 'true');
    await fourth.focus(); // aria-disabled, not disabled: still reachable by keyboard
    await expect(fourth).toBeFocused();
    await expect(page.getByText('Up to 3 toppings — remove one to swap.')).toBeVisible();
    await fourth.check({ force: true }).catch(() => undefined);
    await expect(fourth).not.toBeChecked();

    await boxes[0]!.uncheck({ force: true });
    await expect(fourth).not.toHaveAttribute('aria-disabled', 'true');
  });
});

test('quantity stops at 10 with its hint', async ({ page }) => {
  await openProduct(page);
  const more = page.getByRole('button', { name: /^Increase quantity/ });
  for (let i = 0; i < 9; i++) await more.click();
  await expect(more).toBeDisabled();
  await expect(page.getByText('10 is the most per item.')).toBeVisible();
});

test('a sold-out product renders with a disabled button', async ({ page }) => {
  const picked = await pickProduct();
  await withSoldOut(picked.id, async () => {
    await page.goto(`/products/${picked.id}`);
    await expect(
      page.getByRole('main').getByText('Sold out for today — back tomorrow.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sold out for today' })).toBeDisabled();
    // the pickers stay readable
    await expect(page.getByRole('radio', { name: /^S · Small/ })).toBeVisible();
  });
});

test('a missing id and a malformed id are both "not on the menu"', async ({ page }) => {
  for (const path of ['/products/01a0e67a-33af-7000-8000-000000000000', '/products/nope']) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: "This item isn't on the menu any more" }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to menu' })).toBeVisible();
  }
});

test('Add returns to the menu where the customer left it, with the toast and the badge', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Categories' })
    .getByRole('link', { name: 'Pastry' })
    .click();
  const before = await settledScrollY(page);
  expect(before).toBeGreaterThan(500);

  await page.getByRole('link', { name: /^Croissant/ }).click();
  await expect(page.getByRole('heading', { name: 'Croissant', level: 1 })).toBeVisible();
  await addButton(page).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('status').filter({ hasText: 'Added to cart' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View cart' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart, 1 item' })).toBeVisible();
  await expect.poll(() => settledScrollY(page)).toBeGreaterThan(before - 10);
  expect(Math.abs((await settledScrollY(page)) - before)).toBeLessThan(10);
});

test('a product opened by its link goes to the menu after Add', async ({ page }) => {
  const detail = await openProduct(page);
  expect(detail.name.en).not.toBe('');
  await addButton(page).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Cart, 1 item' })).toBeVisible();
});

test('adding past the cap of one line adds only what fits and says so', async ({ page }) => {
  const product = await openProduct(page);
  const more = page.getByRole('button', { name: /^Increase quantity/ });
  for (let i = 0; i < 8; i++) await more.click(); // 9
  await addButton(page).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto(`/products/${product.id}`);
  for (let i = 0; i < 2; i++)
    await page.getByRole('button', { name: /^Increase quantity/ }).click(); // 3
  await addButton(page).click();
  await expect(page.getByText('Added 1 — 10 is the most per item.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart, 10 items' })).toBeVisible();
});

test('when the line is already at 10 the button is disabled with the hint', async ({ page }) => {
  const product = await openProduct(page);
  const more = page.getByRole('button', { name: /^Increase quantity/ });
  for (let i = 0; i < 9; i++) await more.click();
  await addButton(page).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto(`/products/${product.id}`);
  await expect(addButton(page)).toBeDisabled();
  await expect(page.getByText('10 is the most per item.')).toBeVisible();
});
