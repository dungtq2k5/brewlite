import { expect, test as base, type Page } from '@playwright/test';
import { PASSWORD, adminToken, api, createAccount, seedPassword, signIn, test } from './support';

test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });
void base;

async function asAdmin(page: Page) {
  await signIn(page, 'admin@brewlite.test', seedPassword());
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
}

async function openUser(page: Page, email: string) {
  await page.goto(`/admin/users?q=${encodeURIComponent(email)}`);
  await page
    .getByRole('row', { name: new RegExp(email) })
    .getByRole('link')
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Access' })).toBeVisible();
}

test('a new customer: role to Staff, lock until a date, unlock, deactivate, restore', async ({
  page,
  browser,
}) => {
  const { email } = await createAccount();
  await asAdmin(page);
  await openUser(page, email);

  await page.getByRole('button', { name: 'Change role…' }).click();
  await page.getByRole('dialog').getByRole('combobox').selectOption('STAFF');
  await page.getByRole('dialog').getByRole('button', { name: 'Change role' }).click();
  await expect(
    page.getByRole('heading', { level: 1 }).locator('..').getByText('Staff'),
  ).toBeVisible();

  // Their next sign-in lands them on the staff board.
  const other = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const staff = await other.newPage();
  await signIn(staff, email, PASSWORD);
  await expect(staff.getByRole('button', { name: 'Open account menu' })).toBeVisible();
  await staff.goto('/staff');
  await expect(staff.getByRole('heading', { name: 'Orders board' })).toBeVisible();
  await other.close();

  await page.getByRole('button', { name: 'Lock account…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lock account' }).click();
  await expect(page.getByText('Give a reason.')).toBeVisible();
  await page.getByLabel(/^Reason/).fill('e2e check');
  const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel(/^Until/).fill(day);
  await page.getByRole('dialog').getByRole('button', { name: 'Lock account' }).click();
  await expect(page.getByText(/^Locked until \d+ \w+/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Deactivate…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Deactivate' }).click();
  await expect(page.getByText('Deactivated', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change role…' })).toBeDisabled();
  await page.getByRole('button', { name: 'Restore account' }).click();
  await expect(page.getByRole('button', { name: 'Change role…' })).toBeEnabled();
});

test('your own account: role, lock and deactivate are disabled, with the reason', async ({
  page,
}) => {
  await asAdmin(page);
  await openUser(page, 'admin@brewlite.test');
  for (const name of ['Change role…', 'Lock account…', 'Deactivate…']) {
    const button = page.getByRole('button', { name });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAccessibleDescription(/your own account/);
  }
});

test('the list filters by role and status and keeps them in the address', async ({ page }) => {
  await asAdmin(page);
  await page.goto('/admin/users?role=STAFF');
  await expect(page.getByRole('row', { name: /staff@brewlite.test/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /customer@brewlite.test/ })).toHaveCount(0);
  await page.goto('/admin/users?status=deactivated&sort=nonsense');
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
});

test('LAST_ADMIN: a demoted admin’s still-open session cannot demote the only admin left', async ({
  page,
  browser,
}) => {
  // Reaching the rule takes a race: a second admin is demoted while their page is still open, so
  // the seed admin becomes the only one — and the stale session tries to demote them.
  const { email, id } = await createAccount();
  const token = await adminToken();
  const role = (userId: string, to: string) =>
    api(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ role: to }),
    });
  // Leftover test admins from an earlier broken run would make this not the *last* admin: demote them.
  const admins = await api<{ data: { id: string; email: string }[] }>('/admin/users?role=ADMIN', {
    token,
  });
  for (const stray of admins.body.data.filter((u) => u.email.startsWith('e2e-')))
    await role(stray.id, 'STAFF');
  expect((await role(id, 'ADMIN')).status).toBe(200);

  const other = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const second = await other.newPage();
  await signIn(second, email, PASSWORD);
  await expect(second.getByRole('button', { name: 'Open account menu' })).toBeVisible();
  await asAdmin(page);
  await openUser(page, 'admin@brewlite.test');
  const seedAdminUrl = page.url();
  await second.goto(seedAdminUrl);
  await expect(second.getByRole('heading', { name: 'Access' })).toBeVisible();

  try {
    expect((await role(id, 'STAFF')).status).toBe(200); // the seed admin is now the only admin
    await second.getByRole('button', { name: 'Change role…' }).click();
    await second.getByRole('dialog').getByRole('combobox').selectOption('CUSTOMER');
    await second.getByRole('dialog').getByRole('button', { name: 'Change role' }).click();
    await expect(
      second.getByText(
        'BrewLite needs at least one active admin — make someone else an admin first.',
      ),
    ).toBeVisible();
  } finally {
    await role(id, 'STAFF'); // never leave a test admin behind (a no-op once already demoted)
    await other.close();
  }
  // Still an admin: the rule held.
  await page.goto('/admin/users?role=ADMIN');
  await expect(page.getByRole('row', { name: /admin@brewlite.test/ })).toBeVisible();
});
