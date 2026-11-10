import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, publicMenu, register, test } from './support';

// The welcome hero above the menu (product-overview §3.1).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bl_install_dismissed', '1'));
});

const hide = (page: Page) => page.getByRole('button', { name: 'Hide this' });
const headline = (page: Page) => page.getByRole('main').getByText('Order ahead. Skip the queue.');
const oneH1 = async (page: Page) =>
  expect(page.getByRole('heading', { level: 1 })).toHaveText(['Menu']);

test('a guest sees the full hero; Order now focuses the first category heading', async ({
  page,
}) => {
  const { categories, products } = await publicMenu();
  const first = categories.find((c) => products.some((p) => p.categoryId === c.id))!;
  await page.goto('/');
  await expect(headline(page)).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: '2. Pay' })).toBeVisible();
  await oneH1(page);
  // The first category heading is still above the fold at 390 × 844 (check 1).
  await expect(page.getByRole('heading', { level: 2, name: first.name.en })).toBeInViewport();

  await page.getByRole('link', { name: 'Order now' }).click();
  await expect(page.getByRole('heading', { level: 2, name: first.name.en })).toBeFocused();
});

test('× hides it at once, focuses the search field, and the next HTML has no hero', async ({
  page,
}) => {
  await page.goto('/');
  await hide(page).click();
  await expect(headline(page)).toHaveCount(0);
  await expect(page.getByRole('searchbox').filter({ visible: true })).toBeFocused();
  await oneH1(page);

  // No flash: the server leaves it out of the first HTML, not a script after load.
  await expect
    .poll(async () => (await page.context().cookies()).some((c) => c.name === 'bl_hero'))
    .toBe(true);
  const html = await (await page.request.get('/')).text();
  // The markup, not the copy: the copy also rides in the page's serialised i18n resources.
  expect(html).toContain('id="menu"');
  expect(html).not.toContain('bl-menu-hero');
});

test('a signed-in customer sees the strip; dismissal outlives signing in', async ({ page }) => {
  await register(page);
  await page.goto('/');
  await expect(page.getByText('Welcome back — order ahead, skip the queue.')).toBeVisible();
  await expect(headline(page)).toHaveCount(0);
  await oneH1(page);
  await hide(page).click();
  await expect
    .poll(async () => (await page.context().cookies()).some((c) => c.name === 'bl_hero'))
    .toBe(true);
  await page.reload();
  await expect(page.getByText('Welcome back — order ahead, skip the queue.')).toHaveCount(0);
});

test('typing a query hides the hero; clearing brings it back', async ({ page }) => {
  await page.goto('/');
  const field = page.getByRole('searchbox').filter({ visible: true });
  await field.fill('c');
  await expect(headline(page)).toHaveCount(0);
  await field.fill('');
  await expect(headline(page)).toBeVisible();
});

test('the installed app never shows it — a display-mode: standalone rule hides it', () => {
  // `emulateMedia` cannot set display-mode; the rule itself is checked here, the effect via the MCP.
  const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8');
  expect(css).toMatch(
    /@media \(display-mode: standalone\)\s*\{\s*\.bl-menu-hero\s*\{\s*display: none;/,
  );
});
