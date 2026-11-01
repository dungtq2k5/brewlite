import type { Page } from '@playwright/test';
import {
  api,
  expect,
  publicMenu,
  restoreProduct,
  seedPassword,
  setStock,
  signIn,
  staffProducts,
  staffToken,
  test,
} from './support';

test.use({ viewport: { width: 1024, height: 768 }, hasTouch: false, isMobile: false });

async function openStock(page: Page) {
  await signIn(page, 'staff@brewlite.test', seedPassword());
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
  await page.goto('/staff/products');
  await expect(page.getByRole('heading', { name: 'Stock', level: 1 })).toBeVisible();
}

const row = (page: Page, name: string) =>
  page
    .getByRole('listitem')
    .filter({ has: page.getByRole('switch', { name: `Available, ${name}` }) });

test('products by category with a badge for why each is off sale', async ({ page }) => {
  await openStock(page);
  const products = await staffProducts();
  await expect(page.getByRole('link', { name: `Products · ${products.length}` })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Coffee', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pastry', level: 2 })).toBeVisible();
  const latte = (await staffProducts()).find((p) => p.name.en === 'Latte')!;
  try {
    await row(page, 'Latte').getByRole('switch').uncheck();
    await expect(row(page, 'Latte').getByText('Sold out · switched off')).toBeVisible();
    await expect
      .poll(async () => (await staffProducts()).find((p) => p.id === latte.id)!.isAvailable)
      .toBe(false);
    const { products: menu } = await publicMenu();
    await expect
      .poll(async () => (await publicMenu()).products.find((p) => p.id === latte.id)!.isSoldOut)
      .toBe(true);
    expect(menu.length).toBeGreaterThan(0);
    await row(page, 'Latte').getByRole('switch').check();
    await expect(row(page, 'Latte').getByText('On sale', { exact: true })).toBeVisible();
  } finally {
    await restoreProduct(latte);
  }
});

test('a topping switches off and back on', async ({ page }) => {
  await openStock(page);
  await page.getByRole('link', { name: /^Toppings · \d+$/ }).click();
  await expect(page).toHaveURL(/tab=toppings/);
  const toppings = (
    await api<{ data: { id: string; name: { en: string }; isAvailable: boolean }[] }>(
      '/staff/toppings',
      { token: await staffToken() },
    )
  ).body.data;
  const first = toppings[0]!;
  const toggle = page.getByRole('switch', { name: `Available, ${first.name.en}` });
  try {
    await toggle.uncheck();
    await expect
      .poll(async () => {
        const now = (
          await api<{ data: { id: string; isAvailable: boolean }[] }>('/staff/toppings', {
            token: await staffToken(),
          })
        ).body.data;
        return now.find((t) => t.id === first.id)!.isAvailable;
      })
      .toBe(false);
  } finally {
    await api(`/staff/toppings/${first.id}/availability`, {
      method: 'PATCH',
      token: await staffToken(),
      body: JSON.stringify({ isAvailable: first.isAvailable }),
    });
  }
  await page.reload();
  await expect(page).toHaveURL(/tab=toppings/);
  await expect(page.getByRole('switch', { name: `Available, ${first.name.en}` })).toBeVisible();
});

test('counting: save 5, two quick −1 taps end at 3 with no conflict, then stop counting', async ({
  page,
}) => {
  const croissant = (await staffProducts()).find((p) => p.name.en === 'Croissant')!;
  try {
    await setStock(croissant.id, null); // start from "not counted"
    await openStock(page);
    const r = row(page, 'Croissant');
    await r.getByRole('button', { name: 'Count stock' }).click();
    await r.getByRole('textbox').fill('5');
    await r.getByRole('button', { name: 'Save', exact: true }).click();
    await expect
      .poll(async () => (await staffProducts()).find((p) => p.id === croissant.id)!.stockQty)
      .toBe(5);

    await r.getByRole('button', { name: /^One less/ }).click();
    await r.getByRole('button', { name: /^One less/ }).click();
    await expect(r.getByRole('status')).toHaveText('3');
    await expect
      .poll(async () => (await staffProducts()).find((p) => p.id === croissant.id)!.stockQty)
      .toBe(3);
    await expect(r.getByText(/count changed/)).toHaveCount(0);

    await r.getByRole('button', { name: 'Stop counting' }).click();
    await expect
      .poll(async () => (await staffProducts()).find((p) => p.id === croissant.id)!.stockQty)
      .toBeNull();
    await expect(r.getByText('Not counted')).toBeVisible();
  } finally {
    await restoreProduct(croissant);
  }
});

test('an order racing the edit: the row resets to the server’s count with the conflict line', async ({
  page,
}) => {
  const croissant = (await staffProducts()).find((p) => p.name.en === 'Croissant')!;
  try {
    await setStock(croissant.id, null);
    await openStock(page);
    // Someone else counts it between this page's load and its save.
    await setStock(croissant.id, 7);
    const r = row(page, 'Croissant');
    await r.getByRole('button', { name: 'Count stock' }).click();
    await r.getByRole('textbox').fill('9');
    await r.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      r.getByText("The count changed while you were editing — it's 7 now. Enter your count again."),
    ).toBeVisible();
    await expect(r.getByRole('status')).toHaveText('7');
  } finally {
    await restoreProduct(croissant);
  }
});

test('the toppings tab survives a reload', async ({ page }) => {
  await openStock(page);
  await page.getByRole('link', { name: /^Toppings/ }).click();
  await expect(page).toHaveURL(/tab=toppings/);
  await page.reload();
  await expect(page.getByRole('link', { name: /^Toppings/ })).toHaveAttribute(
    'aria-current',
    'page',
  );
});
