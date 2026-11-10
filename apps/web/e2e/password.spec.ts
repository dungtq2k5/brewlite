import { expect, PASSWORD, register, signIn, test } from './support';

// The password form on the account page (D06 decision 9). Each test registers its own account.

test('change: a wrong current password keeps the new one typed; the right one signs other devices out; the new password signs in', async ({
  page,
}) => {
  const { email } = await register(page);
  await page.goto('/account');
  await page.getByRole('button', { name: 'Change password' }).click();
  const submit = page.getByRole('button', { name: 'Update password' });
  await expect(submit).toBeDisabled();

  await page.getByLabel('Current password', { exact: true }).fill('not-the-password');
  await page.getByLabel('New password', { exact: true }).fill('brand-new-password');
  await submit.click();
  await expect(page.getByText("That isn't your current password.")).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toHaveValue('brand-new-password');

  await page.getByLabel('Current password', { exact: true }).fill(PASSWORD);
  await submit.click();
  await expect(
    page.getByText("Password changed. You've been signed out on your other devices."),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page
    .getByRole('dialog', { name: 'Account' })
    .getByRole('button', { name: 'Sign out' })
    .click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await signIn(page, email, 'brand-new-password');
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
});

test('a new password is checked in bytes before anything is sent', async ({ page }) => {
  await register(page);
  await page.goto('/account');
  await page.getByRole('button', { name: 'Change password' }).click();
  await page.getByLabel('Current password', { exact: true }).fill(PASSWORD);
  const phrase = 'Mỗi sáng tôi uống một ly cà phê sữa đá thật đậm ở góc phố cũ Hà Nội'; // 67 chars, 95 bytes
  await page.getByLabel('New password', { exact: true }).fill(phrase);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText('That password is too long — try a shorter one.')).toBeVisible();
  await page.getByLabel('New password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText('Use 8 or more characters.')).toBeVisible();
});

test('a Google (emulator) account sets a first password and can then sign in by email', async ({
  page,
  context,
}) => {
  test.setTimeout(60_000); // the emulator's popup and two sign-ins
  await page.goto('/login');
  const popupPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await popup.getByRole('button', { name: /Add new account/i }).click();
  // The emulator's form: Email is its first text box (a hidden duplicate input carries the label).
  const email = `google-${Date.now()}@example.com`;
  await popup.getByRole('textbox').first().fill(email);
  await popup.getByRole('button', { name: /Sign in with Google\.com/i }).click();
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible({
    timeout: 15_000,
  });

  await page.goto('/account');
  await expect(page.getByText('You sign in with Google')).toBeVisible();
  await page.getByRole('button', { name: 'Set a password' }).click();
  await expect(page.getByLabel('Current password', { exact: true })).toHaveCount(0);
  await page.getByLabel('New password', { exact: true }).fill('first-password-1');
  await page.getByRole('button', { name: 'Set password' }).click();
  await expect(
    page.getByText('Password set. You can now sign in with Google or your email.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change password' })).toBeVisible();
  // Both ways in are listed now (`116:2842`).
  await expect(page.getByText('You sign in with Google')).toBeVisible();
  await expect(page.getByText('You sign in with email and password')).toBeVisible();

  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page
    .getByRole('dialog', { name: 'Account' })
    .getByRole('button', { name: 'Sign out' })
    .click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await signIn(page, email, 'first-password-1');
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
});
