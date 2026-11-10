import { expect, register, seedPassword, signIn, storedCart, test } from './support';

test('the guest header: logo, language, cart, sign in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'BrewLite home' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Language' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible();
});

test('every page carries a Content-Security-Policy with a fresh nonce', async ({ request }) => {
  const nonce = async () => {
    const res = await request.get('/');
    const policy = res.headers()['content-security-policy'] ?? '';
    expect(policy).toContain("script-src 'self' 'nonce-");
    expect(policy).toContain("frame-ancestors 'none'");
    return /'nonce-([^']+)'/.exec(policy)?.[1];
  };
  const first = await nonce();
  expect(first).toBeTruthy();
  expect(await nonce()).not.toBe(first);
});

test('the wordmark is gone below 380 px and the symbol keeps the home link', async ({
  page,
}, info) => {
  await page.goto('/');
  const home = page.getByRole('link', { name: 'BrewLite home' });
  const box = await home.boundingBox();
  if (info.project.name === 'narrow') {
    expect(box!.width).toBeLessThan(60);
  } else {
    expect(box!.width).toBeGreaterThan(100);
  }
});

test('every control is at least 44 px', async ({ page }) => {
  await page.goto('/');
  for (const locator of [
    page.getByRole('link', { name: 'Cart', exact: true }),
    page.getByRole('link', { name: 'Sign in' }),
  ]) {
    const box = await locator.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(43.5);
    expect(box!.width).toBeGreaterThanOrEqual(43.5);
  }
});

test('the language switch is the compact pill of the design, with a 44 px hit area', async ({
  page,
}) => {
  await page.goto('/');
  const pill = page.getByRole('group', { name: 'Language' });
  const box = (await pill.boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(40); // frame 55:4679: a 38 px pill
  expect(box.width).toBeLessThanOrEqual(80);
  const vi = page.getByRole('button', { name: 'Tiếng Việt' });
  const target = (await vi.boundingBox())!;
  // 22 px above and below the segment's centre is still the segment: a 44 px target.
  for (const dy of [-21, 21]) {
    const hit = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.getAttribute('aria-label'),
      [target.x + target.width / 2, target.y + target.height / 2 + dy],
    );
    expect(hit).toBe('Tiếng Việt');
  }
});

test('the account sheet of a customer lists no role links', async ({ page }) => {
  await register(page);
  await page.getByRole('button', { name: 'Open account menu' }).click();
  const sheet = page.getByRole('dialog', { name: 'Account' });
  await expect(sheet.getByRole('link', { name: 'My orders' })).toBeVisible();
  await expect(sheet.getByRole('link', { name: 'Account' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await expect(sheet.getByRole('link', { name: 'Staff board' })).toHaveCount(0);
  await expect(sheet.getByRole('link', { name: 'Admin' })).toHaveCount(0);
});

test('staff see the board link, admin sees both', async ({ page }) => {
  await signIn(page, 'staff@brewlite.test', seedPassword());
  await page.getByRole('button', { name: 'Open account menu' }).click();
  const staff = page.getByRole('dialog', { name: 'Account' });
  await expect(staff.getByRole('link', { name: 'Staff board' })).toBeVisible();
  await expect(staff.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  await staff.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

  await signIn(page, 'admin@brewlite.test', seedPassword());
  await page.getByRole('button', { name: 'Open account menu' }).click();
  const admin = page.getByRole('dialog', { name: 'Account' });
  await expect(admin.getByRole('link', { name: 'Staff board' })).toBeVisible();
  await expect(admin.getByRole('link', { name: 'Admin' })).toBeVisible();
});

test('the cart badge counts what is in the cart, and sign-out asks before clearing it', async ({
  page,
}) => {
  await register(page);
  await page.evaluate(
    (cart) => localStorage.setItem('bl_cart', cart),
    storedCart([
      { productId: 'x', quantity: 2 },
      { productId: 'y', quantity: 1 },
    ]),
  );
  await page.reload();
  await expect(page.getByRole('link', { name: 'Cart, 3 items' })).toBeVisible();
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page
    .getByRole('dialog', { name: 'Account' })
    .getByRole('button', { name: 'Sign out' })
    .click();
  const confirm = page.getByRole('alertdialog', { name: 'Sign out?' });
  await confirm.getByRole('button', { name: 'Keep shopping' }).click();
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page
    .getByRole('dialog', { name: 'Account' })
    .getByRole('button', { name: 'Sign out' })
    .click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bl_cart'))).toBeNull();
});
