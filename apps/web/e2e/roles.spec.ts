import { expect, seedPassword, signIn, test } from './support';

test('a customer is sent home from /staff and /admin', async ({ page }) => {
  await signIn(page, 'customer@brewlite.test', seedPassword());
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
  for (const path of ['/staff', '/admin']) {
    await page.goto(path);
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  }
});

test('a customer on the staff board and stock pages is sent to the menu', async ({ page }) => {
  await signIn(page, 'customer@brewlite.test', seedPassword());
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
  for (const path of ['/staff', '/staff/products']) {
    await page.goto(path);
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  }
});

test('a guest is sent home from /staff and /admin', async ({ page }) => {
  for (const path of ['/staff', '/admin']) {
    await page.goto(path);
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  }
});

test('staff reach /staff but not /admin', async ({ page }) => {
  await signIn(page, 'staff@brewlite.test', seedPassword());
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
  await page.goto('/staff');
  // The phone frame's title is the short one.
  await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
  await page.goto('/admin');
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toHaveCount(0);
});

// The admin frame is the desktop one (1280 × 800, frame 15:658).
test.describe('admin', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  test('admin reaches both', async ({ page }) => {
    await signIn(page, 'admin@brewlite.test', seedPassword());
    await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
    await page.goto('/staff');
    await expect(page.getByRole('heading', { name: 'Orders board' })).toBeVisible();
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /^Good (morning|afternoon|evening)/,
    );
    await page.getByRole('button', { name: 'Open account menu' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Account' }).getByRole('link', { name: 'Admin' }),
    ).toBeVisible();
  });
});
