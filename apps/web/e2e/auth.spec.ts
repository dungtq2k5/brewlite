import { expect, register, signIn, test } from './support';

test('register → signed in → sign out → sign in; tokens never reach page JavaScript', async ({
  page,
  context,
}) => {
  const { email, password } = await register(page);

  const cookies = await context.cookies();
  const access = cookies.find((c) => c.name === 'bl_at');
  const refresh = cookies.find((c) => c.name === 'bl_rt');
  expect(access?.httpOnly).toBe(true);
  expect(refresh?.httpOnly).toBe(true);
  expect(access?.sameSite).toBe('Lax');
  expect(await page.evaluate(() => document.cookie)).not.toMatch(/bl_at|bl_rt/);

  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page
    .getByRole('dialog', { name: 'Account' })
    .getByRole('button', { name: 'Sign out' })
    .click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  expect((await context.cookies()).some((c) => c.name === 'bl_at')).toBe(false);

  await signIn(page, email, password);
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
});

test('a guest at /checkout is sent to sign in and comes back', async ({ page }) => {
  const { email, password } = await register(page);
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page
    .getByRole('dialog', { name: 'Account' })
    .getByRole('button', { name: 'Sign out' })
    .click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

  await page.goto('/checkout');
  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout$/);
  await expect(page.getByText('Sign in to place your order — your cart is saved.')).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/); // the page itself arrives in a later doc: a 404 is fine
});

test('a hostile next never leaves the site', async ({ page }) => {
  const { email, password } = await register(page);
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page
    .getByRole('dialog', { name: 'Account' })
    .getByRole('button', { name: 'Sign out' })
    .click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

  await page.goto('/login?next=//evil.example');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
  expect(new URL(page.url()).origin).toBe(new URL('/', page.url()).origin);
  expect(new URL(page.url()).pathname).toBe('/');
});

test('the session refreshes: without bl_at a reload is still signed in, with a new bl_at', async ({
  page,
  context,
}) => {
  await register(page);
  const before = (await context.cookies()).find((c) => c.name === 'bl_at')!;
  await context.clearCookies({ name: 'bl_at' });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
  const after = (await context.cookies()).find((c) => c.name === 'bl_at');
  expect(after?.value).toBeTruthy();
  expect(after?.value).not.toBe(before.value);
});

test('an expired refresh token makes the visitor a guest again', async ({ page, context }) => {
  await register(page);
  await context.clearCookies({ name: 'bl_at' });
  const refresh = (await context.cookies()).find((c) => c.name === 'bl_rt')!;
  await context.clearCookies({ name: 'bl_rt' });
  await context.addCookies([{ ...refresh, value: 'not-a-real-token' }]);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  const names = (await context.cookies()).map((c) => c.name);
  expect(names).not.toContain('bl_rt');
});
