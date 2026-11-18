import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { addDrink, expect, register, test } from '../support';
import {
  heroDismissed,
  holdFiveSecondTimers,
  seeded,
  vietnamese,
  withAllSoldOut,
  withPhoto,
} from './data';
import { look } from './look';

// Customer — the menu (D02, D06, D07). Each row follows its frame's *Reach* annotation.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bl_install_dismissed', '1'));
});

const menuHeading = (page: Page, name = 'Menu') =>
  expect(page.getByRole('heading', { level: 1, name })).toBeAttached();
const search = (page: Page) =>
  page
    .getByRole('search', { name: /Search the menu|Tìm trong thực đơn/ })
    .getByRole('searchbox')
    .first();

test('customer-menu-guest', async ({ page }) => {
  await page.goto('/');
  await menuHeading(page);
  await expect(page.getByRole('main').getByText('Order ahead. Skip the queue.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hide this' })).toBeVisible();
  await look(page, 'customer-menu-guest');
});

test('customer-menu-guest-vi', async ({ page, baseURL }) => {
  await vietnamese(page.context(), baseURL!);
  await page.goto('/');
  await menuHeading(page, 'Thực đơn');
  await expect(page.getByRole('main').getByText('Đặt trước. Khỏi xếp hàng.')).toBeVisible();
  await look(page, 'customer-menu-guest-vi');
});

test('customer-menu-signed-in', async ({ page }) => {
  await register(page);
  await page.goto('/');
  await expect(
    page.getByRole('main').getByText('Welcome back — order ahead, skip the queue.'),
  ).toBeVisible();
  await look(page, 'customer-menu-signed-in');
});

test('customer-menu-no-hero', async ({ page, baseURL }) => {
  await heroDismissed(page.context(), baseURL!);
  await page.goto('/');
  await menuHeading(page);
  await expect(page.getByRole('button', { name: 'Hide this' })).toHaveCount(0);
  await look(page, 'customer-menu-no-hero');
});

test('customer-menu-scrolled', async ({ page, baseURL }) => {
  await heroDismissed(page.context(), baseURL!);
  await page.goto('/');
  const tea = page
    .getByRole('navigation', { name: 'Categories' })
    .getByRole('link', { name: 'Tea', exact: true });
  await tea.click();
  await expect(tea).toHaveAttribute('aria-current', 'true');
  await look(page, 'customer-menu-scrolled', { keepScroll: true });
});

test('customer-menu-photos', async ({ page, baseURL }) => {
  await heroDismissed(page.context(), baseURL!);
  const product = await seeded('Iced milk coffee');
  const png = readFileSync(new URL('../../public/icon-512.png', import.meta.url));
  await withPhoto(product.id, png, async () => {
    await page.goto('/');
    await expect(page.getByRole('img', { name: product.name.en, exact: true })).toBeVisible();
    await look(page, 'customer-menu-photos');
  });
});

test('customer-menu-all-sold-out', async ({ page }) => {
  await withAllSoldOut(async () => {
    await page.goto('/');
    await expect(
      page.getByRole('main').getByText("Everything's sold out for today — see you tomorrow."),
    ).toBeVisible();
    await look(page, 'customer-menu-all-sold-out');
  });
});

test('customer-menu-added', async ({ page, baseURL }) => {
  await heroDismissed(page.context(), baseURL!);
  // The toast closes after 5 s; held, so the checks and the drawing can't outlast it.
  await holdFiveSecondTimers(page);
  await addDrink(page, await seeded('Iced milk coffee'));
  await expect(page.getByRole('status').filter({ hasText: 'Added to cart' })).toBeVisible();
  await look(page, 'customer-menu-added');
});

/** Types a query and waits for its result line — the search rows' shared *Reach*. */
async function searchFor(page: Page, baseURL: string, query: string, expected: RegExp, vi = false) {
  await heroDismissed(page.context(), baseURL);
  if (vi) await vietnamese(page.context(), baseURL);
  await page.goto('/');
  await search(page).fill(query);
  await expect(page.getByText(expected).filter({ visible: true }).first()).toBeVisible();
}

// `look()` ids stay literal, one per test: states.test.ts scans for them.
test('customer-menu-search-results', async ({ page, baseURL }) => {
  await searchFor(page, baseURL!, 'milk', /^\d+ results?$/);
  await look(page, 'customer-menu-search-results');
});

test('customer-menu-search-accentless', async ({ page, baseURL }) => {
  await searchFor(page, baseURL!, 'ca phe', /^\d+ results?$/);
  await look(page, 'customer-menu-search-accentless');
});

test('customer-menu-search-no-results', async ({ page, baseURL }) => {
  // The frame types `matcha`, but the seed has Matcha milk tea and Matcha frappé: a word with no match.
  await searchFor(page, baseURL!, 'kombucha', /^Nothing called "kombucha" on the menu$/);
  await look(page, 'customer-menu-search-no-results');
});

test('customer-menu-search-vi', async ({ page, baseURL }) => {
  await searchFor(page, baseURL!, 'milk tea', /^\d+ kết quả$/, true);
  await look(page, 'customer-menu-search-vi');
});

test('customer-menu-search-no-results-vi', async ({ page, baseURL }) => {
  await searchFor(page, baseURL!, 'kombucha', /^Thực đơn không có món nào tên "kombucha"$/, true);
  await look(page, 'customer-menu-search-no-results-vi');
});
