import { expect, test } from './support';

test('switching language re-renders, survives a reload and sets <html lang>', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: 'Tiếng Việt' }).click();
  await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Thực đơn' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Thực đơn' })).toBeVisible();
  const locale = (await page.context().cookies()).find((c) => c.name === 'bl_locale');
  expect(locale?.value).toBe('vi');
});

test('a half-typed login form keeps its text across a switch', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('half@example.com');
  await page.getByLabel('Password', { exact: true }).fill('abc');
  await page.getByRole('button', { name: 'Tiếng Việt' }).click();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveValue('half@example.com');
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue('abc');
});

test('a cookie with an unsupported value falls back to English', async ({ page, context }) => {
  await context.addCookies([{ name: 'bl_locale', value: 'fr', url: 'http://localhost:23000' }]);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
