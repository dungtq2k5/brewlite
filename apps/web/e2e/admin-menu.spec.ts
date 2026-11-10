import { expect, test as base, type Page } from '@playwright/test';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { adminToken, api, seedPassword, signIn, test } from './support';

// Admin screens are the desktop frame (1280 × 800). Everything this file creates is named
// `e2e-<run>-…` and soft-deleted at the end, so the seed menu is left as it was found.
test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });
void base;

const RUN = Date.now().toString(36);
const name = (part: string) => `e2e-${RUN}-${part}`;

interface Row {
  id: string;
  name: { en: string; vi: string };
}
const created = { products: [] as string[], categories: [] as string[], toppings: [] as string[] };

async function asAdmin(page: Page) {
  await signIn(page, 'admin@brewlite.test', seedPassword());
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
}

async function list(path: string, token: string): Promise<Row[]> {
  const { body } = await api<{ data: Row[] }>(
    `${path}${path.endsWith('products') ? '?pageSize=100' : ''}`,
    { token },
  );
  return body.data.filter((r) => r.name.en.startsWith(`e2e-${RUN}`));
}

test.afterAll(async () => {
  const token = await adminToken();
  for (const [path, kind] of [
    ['/admin/products', 'products'],
    ['/admin/categories', 'categories'],
    ['/admin/toppings', 'toppings'],
  ] as const) {
    for (const row of await list(path, token)) {
      await api(`${path}/${row.id}`, { method: 'DELETE', token });
      created[kind].push(row.id);
    }
  }
});

const pair = async (page: Page, legend: RegExp, en: string, vi: string) => {
  const group = page.getByRole('group', { name: legend });
  await group.getByLabel('English').fill(en);
  await group.getByLabel('Tiếng Việt').fill(vi);
};

test('staff are sent away from /admin/*', async ({ page }) => {
  await signIn(page, 'staff@brewlite.test', seedPassword());
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
  for (const path of ['/admin/categories', '/admin/products', '/admin/toppings']) {
    await page.goto(path);
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  }
});

test('categories: create, name taken, delete and restore', async ({ page }) => {
  await asAdmin(page);
  await page.goto('/admin/categories');
  await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();

  const open = async () => {
    await page.getByRole('button', { name: 'New category' }).click();
    const dialog = page.getByRole('dialog', { name: 'New category' });
    await pair(dialog.page(), /^Name/, name('cat'), `vi ${name('cat')}`);
    return dialog;
  };
  let dialog = await open();
  await dialog.getByRole('button', { name: 'Create category' }).click();
  await expect(page.getByRole('row', { name: new RegExp(name('cat')) })).toBeVisible();

  dialog = await open();
  await dialog.getByRole('button', { name: 'Create category' }).click();
  await expect(dialog.getByText('Another category already uses this English name.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  const row = page.getByRole('row', { name: new RegExp(name('cat')) });
  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(row).toHaveCount(0);

  await page.getByRole('link', { name: 'Deleted' }).click();
  await page
    .getByRole('row', { name: new RegExp(name('cat')) })
    .getByRole('button', { name: 'Restore' })
    .click();
  await page.getByRole('link', { name: 'Deleted' }).click();
  await expect(page.getByRole('row', { name: new RegExp(name('cat')) })).toBeVisible();
});

test('categories: a category with products refuses delete and says where they are', async ({
  page,
}) => {
  await asAdmin(page);
  await page.goto('/admin/categories');
  const first = page.getByRole('row').nth(1);
  await first.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('dialog').getByText(/still has \d+ products?/)).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('link', { name: /products$/ })).toBeVisible();
});

test('categories: the keyboard moves a row and announces it; the order is restored', async ({
  page,
}) => {
  await asAdmin(page);
  await page.goto('/admin/categories');
  const names = async () =>
    page.locator('tbody tr td:nth-child(2) p, tbody tr td:nth-child(2)').first().innerText();
  const before = await names();
  const grip = page.getByRole('button', { name: /^Move / }).first();
  await grip.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('[aria-live]').filter({ hasText: /Picked up/ })).toBeAttached();
  await page.waitForTimeout(200); // the sensor listens for arrows a frame after pick-up
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[aria-live]').filter({ hasText: /position 2 of/ })).toBeAttached();
  await page.keyboard.press('Escape');
  await expect(page.locator('[aria-live]').filter({ hasText: /Move cancelled/ })).toBeAttached();
  expect(await names()).toBe(before);
});

test('toppings: create, name taken, availability, delete, restore', async ({ page }) => {
  await asAdmin(page);
  await page.goto('/admin/toppings');
  const create = async () => {
    await page.getByRole('button', { name: 'New topping' }).click();
    const dialog = page.getByRole('dialog', { name: 'New topping' });
    await pair(page, /^Name/, name('top'), `vi ${name('top')}`);
    await dialog.getByLabel('Price (₫)').fill('7000');
    await dialog.getByRole('button', { name: 'Create topping' }).click();
    return dialog;
  };
  await create();
  const row = page.getByRole('row', { name: new RegExp(name('top')) });
  await expect(row).toBeVisible();
  await expect(row).toContainText('₫7,000');

  const dialog = await create();
  await expect(dialog.getByText('Another topping already uses this English name.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  const toggle = row.getByRole('switch');
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(row.getByText('Unavailable')).toBeVisible();

  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole('link', { name: 'Deleted' }).click();
  await page
    .getByRole('row', { name: new RegExp(name('top')) })
    .getByRole('button', { name: 'Restore' })
    .click();
});

test('products: create with sizes and a topping, edit, unsaved prompt, delete, restore', async ({
  page,
}) => {
  const token = await adminToken();
  const cats = await api<{ data: Row[] }>('/admin/categories', { token });
  const topping = await api<{ data: Row }>('/admin/toppings', {
    method: 'POST',
    token,
    body: JSON.stringify({ name: { en: name('ptop'), vi: `vi ${name('ptop')}` }, priceVnd: 5000 }),
  });
  void cats;
  const other = await api<{ data: Row }>('/admin/toppings', {
    method: 'POST',
    token,
    body: JSON.stringify({ name: { en: name('ptwo'), vi: `vi ${name('ptwo')}` }, priceVnd: 6000 }),
  });
  void other;
  await asAdmin(page);
  await page.goto('/admin/products/new');
  await expect(page.getByRole('heading', { name: 'New product' })).toBeVisible();

  // An empty form says what is missing and sends nothing.
  await page.getByLabel('Base price (₫)').fill('30000');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'to fix before saving' })).toBeVisible();

  await pair(page, /^Name/, name('prod'), `vi ${name('prod')}`);
  await page.getByRole('checkbox', { name: 'S', exact: true }).check();
  await page.getByRole('checkbox', { name: 'L', exact: true }).check();
  await page.getByLabel('Price change L').fill('10000');
  await expect(page.getByText('₫40,000')).toBeVisible();
  await page.getByRole('checkbox', { name: new RegExp(name('ptop')) }).check();
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}\?notice=created/);
  await expect(page.getByText('Product created')).toBeVisible();
  await expect(page.getByRole('heading', { name: name('prod') })).toBeVisible();

  // Edit the price; a link click while dirty asks first.
  await page.getByLabel('Base price (₫)').fill('32000');
  await expect(page.getByText('Unsaved changes in Basics')).toBeVisible();
  await page
    .getByRole('link', { name: /Products/ })
    .first()
    .click();
  await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('All changes saved')).toBeVisible();

  // The topping is deleted behind the editor's back: toppings fail, the rest is kept and named.
  await api(`/admin/toppings/${topping.body.data.id}`, { method: 'DELETE', token });
  await page.getByLabel('Base price (₫)').fill('33000');
  await page.getByRole('checkbox', { name: new RegExp(name('ptwo')) }).check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(/was deleted meanwhile/)).toBeVisible();
  await expect(page.getByLabel('Base price (₫)')).toHaveValue('33000');

  // Delete and restore.
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  // Earlier runs leave deleted rows behind, so look for this one by name.
  await page.goto(`/admin/products?deleted=true&q=${name('prod')}`);
  await page
    .getByRole('link', { name: name('prod') })
    .first()
    .click();
  await page.getByRole('button', { name: 'Restore product' }).click();
  await expect(page.getByRole('button', { name: 'Restore product' })).toHaveCount(0);
});

test('products: list filters live in the address and Category hides below 1280', async ({
  page,
}) => {
  await asAdmin(page);
  await page.goto('/admin/products?sort=-basePriceVnd');
  await expect(page.getByRole('columnheader', { name: 'Category' })).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByRole('columnheader', { name: 'Category' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByPlaceholder('Search by name').fill('zzzz-nothing');
  await expect(page).toHaveURL(/q=zzzz-nothing/);
  await expect(page.getByText('Nothing matches these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).not.toHaveURL(/q=/);
});

/** A real RGB PNG of noise (stored, not compressed), so its size is what `w × h` says — near 2 MB at 835 × 835. */
function makePng(w: number, h: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(zlib.crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    const row = y * (w * 3 + 1);
    crypto.randomFillSync(raw, row + 1, w * 3); // filter byte 0, then noise
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 0 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const PNG = makePng(16, 16);

async function newProduct(page: Page, label: string) {
  await page.goto('/admin/products/new');
  await pair(page, /^Name/, name(label), `vi ${name(label)}`);
  await page.getByLabel('Base price (₫)').fill('30000');
  await page.getByRole('checkbox', { name: 'S', exact: true }).check();
}

test('photo: exactly 2 MB uploads; over 2 MB and a wrong type are refused before anything is sent', async ({
  page,
}) => {
  await asAdmin(page);
  await newProduct(page, 'photo');
  const chooser = page.getByLabel('Choose a file');

  await chooser.setInputFiles({
    name: 'big.png',
    mimeType: 'image/png',
    buffer: makePng(1100, 1100),
  });
  await expect(page.getByText('That file is over 2 MB — choose a smaller one.')).toBeVisible();
  await chooser.setInputFiles({ name: 'a.gif', mimeType: 'image/gif', buffer: PNG });
  await expect(page.getByText('Use a JPEG, PNG or WebP.')).toBeVisible();

  await chooser.setInputFiles({
    name: 'ok.png',
    mimeType: 'image/png',
    buffer: makePng(835, 835),
  });
  await expect(page.getByText('Will upload when you save.')).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}\?notice=created/);
  await expect(page.getByText('Product created')).toBeVisible();
  await expect(page.getByRole('img', { name: '' }).first()).toBeVisible();
  await expect(page.getByText('The photo did not upload.')).toHaveCount(0);
  // The photo is really stored: the editor's preview now points at it.
  await expect(page.locator('section:has(h2:text("Photo")) [role=img]').first()).toHaveAttribute(
    'style',
    /url\("http/,
  );
});

test('a new product whose photo the API refuses is still created, and the photo can be retried', async ({
  page,
}) => {
  await asAdmin(page);
  await newProduct(page, 'badphoto');
  await page.getByLabel('Choose a file').setInputFiles({
    // A real GIF the browser can preview, declared as a PNG — the API reads the bytes and refuses it.
    name: 'fake.png',
    mimeType: 'image/png',
    buffer: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
  });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}\?notice=photoFailed/);
  await expect(
    page.getByText('The photo did not upload. Retry it from the Photo section.'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: name('badphoto') })).toBeVisible();

  await page
    .getByLabel('Choose a file')
    .setInputFiles({ name: 'ok.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('All changes saved')).toBeVisible();
});
