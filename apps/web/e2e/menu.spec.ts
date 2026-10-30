import { readFileSync } from 'node:fs';
import {
  adminToken,
  api,
  expect,
  productDetail,
  publicMenu,
  test,
  vnd,
  withSoldOut,
} from './support';

test('the menu lists every category with products, in the API order, and every product', async ({
  page,
}) => {
  const { categories, products } = await publicMenu();
  const withProducts = categories.filter((c) => products.some((p) => p.categoryId === c.id));

  await page.goto('/');
  const headings = await page.getByRole('heading', { level: 2 }).allTextContents();
  expect(headings).toEqual(withProducts.map((c) => c.name.en));
  await expect(page.getByRole('link', { name: /from ₫/ })).toHaveCount(products.length);
  const chips = page.getByRole('navigation', { name: 'Categories' }).getByRole('link');
  expect(await chips.allTextContents()).toEqual(withProducts.map((c) => c.name.en));
});

test('a card shows "from" the smallest offered size — a tea starts at M', async ({ page }) => {
  const { products } = await publicMenu();
  const tea = products.find((p) => p.name.en === 'Peach orange lemongrass tea')!;
  const detail = await productDetail(tea.id);
  const smallest = detail.basePriceVnd + Math.min(...detail.sizes.map((s) => s.priceDeltaVnd));
  expect(detail.sizes.map((s) => s.size)).not.toContain('S');

  await page.goto('/');
  const card = page.getByRole('link', { name: /Peach orange lemongrass tea/ });
  await expect(card).toContainText(`from ${vnd(tea.fromPriceVnd)}`);
  expect(tea.fromPriceVnd).toBe(smallest);
});

test('a chip scrolls to its section and the current chip follows the scroll', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Categories' });
  await nav.getByRole('link', { name: 'Milk tea' }).click();

  const heading = page.getByRole('heading', { name: 'Milk tea', level: 2 });
  await expect(nav.getByRole('link', { name: 'Milk tea' })).toHaveAttribute('aria-current', 'true');
  await expect
    .poll(async () => {
      const bar = await nav.boundingBox();
      const box = await heading.boundingBox();
      return box && bar ? box.y - (bar.y + bar.height) : null;
    })
    .toBeGreaterThanOrEqual(0); // below the header and the bar, not under them
  await expect
    .poll(async () => {
      const bar = await nav.boundingBox();
      const box = await heading.boundingBox();
      return box && bar ? box.y - (bar.y + bar.height) : null;
    })
    .toBeLessThan(40);

  // A real scroll, not a tap: the chip of the section under the bar becomes current.
  await page
    .getByRole('heading', { name: 'Pastry', level: 2 })
    .evaluate((h) => h.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.evaluate(() => window.scrollBy(0, 40));
  await expect(nav.getByRole('link', { name: 'Pastry' })).toHaveAttribute('aria-current', 'true');
  await expect(nav.getByRole('link', { name: 'Milk tea' })).not.toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('a sold-out product shows its badge and still opens', async ({ page }) => {
  const { products } = await publicMenu();
  const latte = products.find((p) => p.name.en === 'Latte')!;
  await withSoldOut(latte.id, async () => {
    await page.goto('/');
    const card = page.getByRole('link', { name: /Latte/ });
    await expect(card.getByText('Sold out')).toBeVisible();
    await card.click();
    await expect(page.getByRole('heading', { name: 'Latte', level: 1 })).toBeVisible();
  });
});

test('a category with no product is not shown', async ({ page }) => {
  const token = await adminToken();
  const name = `E2E empty ${crypto.randomUUID().slice(0, 8)}`;
  const created = await api<{ data: { id: string } }>('/admin/categories', {
    method: 'POST',
    token,
    body: JSON.stringify({ name: { en: name, vi: name } }),
  });
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { name, level: 2 })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Categories' }).getByText(name)).toHaveCount(
      0,
    );
  } finally {
    await api(`/admin/categories/${created.body.data.id}`, { method: 'DELETE', token });
  }
});

test('an uploaded photo fills the fixed 1:1 frame of its card', async ({ page }) => {
  const { products } = await publicMenu();
  const product = products.find((p) => p.name.en === 'Espresso')!;
  const token = await adminToken();
  const png = readFileSync(new URL('../public/icon-512.png', import.meta.url));
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'photo.png');
  const upload = await fetch(
    `${process.env.E2E_GATEWAY_URL ?? 'http://localhost:23100/api/v1'}/admin/products/${product.id}/image`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );
  expect(upload.status).toBe(200);
  try {
    await page.goto('/');
    const photo = page.getByRole('img', { name: 'Espresso' });
    await expect(photo).toBeVisible();
    const frame = await photo.evaluate((img) => {
      const box = img.parentElement!.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    expect(Math.abs(frame.width - frame.height)).toBeLessThan(1);
    // The other cards are untouched.
    await expect(page.getByRole('img', { name: 'Latte' })).toHaveCount(0);
  } finally {
    await api(`/admin/products/${product.id}/image`, { method: 'DELETE', token });
  }
});
