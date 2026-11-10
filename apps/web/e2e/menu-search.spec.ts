import type { Page } from '@playwright/test';
import { expect, publicMenu, test } from './support';
import { normalize } from '../src/lib/menu-search';

// Search on the device (D06 decision 10): either language, accents optional, chips narrow.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bl_install_dismissed', '1'));
});

const field = (page: Page) =>
  page.getByRole('search', { name: 'Search the menu' }).getByRole('searchbox').first();

test('typing a Vietnamese name without accents finds it in the English UI; the chips narrow', async ({
  page,
}) => {
  const { products, categories } = await publicMenu();
  const target = products.find(
    (p) =>
      normalize(p.name.vi) !== p.name.vi.toLowerCase() &&
      normalize(p.name.vi) !== normalize(p.name.en),
  );
  expect(target).toBeDefined();
  const words = normalize(target!.name.vi).split(' ').slice(0, 2).join(' ');
  const expected = products.filter(
    (p) => normalize(p.name.vi).includes(words) || normalize(p.name.en).includes(words),
  );
  const withResults = new Set(expected.map((p) => p.categoryId));

  await page.goto('/');
  await field(page).fill(words);
  await expect(
    page.getByText(new RegExp(`^${expected.length} results?$`)).filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(target!.name.en) }).first()).toBeVisible();
  const chips = page.getByRole('navigation', { name: 'Categories' }).getByRole('link');
  await expect(chips).toHaveCount(withResults.size);
  expect(categories.length).toBeGreaterThan(0);
});

test('a Vietnamese query finds English-named drinks; nothing found shows Clear search, which restores the menu', async ({
  page,
}) => {
  const { products } = await publicMenu();
  await page.goto('/');
  const vietnamese = products.find((p) => p.name.vi.includes('sữa'));
  if (vietnamese) {
    await field(page).fill('sữa');
    await expect(
      page.getByRole('link', { name: new RegExp(vietnamese.name.en) }).first(),
    ).toBeVisible();
  }
  await field(page).fill('zzzz matcha zzzz');
  await expect(page.getByText('Nothing called "zzzz matcha zzzz" on the menu')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Categories' }).getByRole('link')).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Clear search' }).last().click();
  await expect(
    page.getByRole('link', { name: new RegExp(products[0]!.name.en) }).first(),
  ).toBeVisible();
});

test('the chip bar’s search icon scrolls back to the field and focuses it', async ({ page }) => {
  await page.goto('/');
  await page.mouse.wheel(0, 2500);
  await page.getByRole('button', { name: 'Search the menu' }).click();
  await expect(field(page)).toBeFocused();
});
