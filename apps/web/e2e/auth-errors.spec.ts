import type { Page } from '@playwright/test';
import { PASSWORD, adminToken, api, createAccount, expect, newEmail, test } from './support';

// Next's route announcer is an empty role=alert; the page's own messages have text.
const alertOf = (page: Page) => page.getByRole('alert').filter({ hasText: /\S/ });

const LOCALES = ['en', 'vi'] as const;
type Loc = (typeof LOCALES)[number];

async function setLocale(page: Page, locale: Loc) {
  await page
    .context()
    .addCookies([{ name: 'bl_locale', value: locale, url: 'http://localhost:23000' }]);
}

const LABEL = {
  en: {
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    create: 'Create account',
    name: 'Full name',
  },
  vi: {
    email: 'Email',
    password: 'Mật khẩu',
    signIn: 'Đăng nhập',
    create: 'Tạo tài khoản',
    name: 'Họ và tên',
  },
} as const;

async function login(page: Page, locale: Loc, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(LABEL[locale].email).fill(email);
  await page.getByLabel(LABEL[locale].password, { exact: true }).fill(password);
  await page.getByRole('button', { name: LABEL[locale].signIn, exact: true }).click();
}

async function registerWith(page: Page, locale: Loc, email: string, password: string) {
  await page.goto('/register');
  await page.getByLabel(LABEL[locale].name).fill('Lan Anh');
  await page.getByLabel(LABEL[locale].email).fill(email);
  await page.getByLabel(LABEL[locale].password, { exact: true }).fill(password);
  await page.getByRole('button', { name: LABEL[locale].create }).click();
}

/** Ten attempts fill `AUTH`'s per-email bucket (10 per 15 minutes); the eleventh, from the page, is refused. */
async function exhaustEmailBucket(email: string) {
  for (let i = 0; i < 10; i++) {
    await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'x'.repeat(8) }),
    });
  }
}

for (const locale of LOCALES) {
  test.describe(`/login states — ${locale}`, () => {
    test.beforeEach(async ({ page }) => setLocale(page, locale));

    test('the form, and the field errors', async ({ page }) => {
      await page.goto('/login');
      await expect(
        page.getByRole('heading', { name: locale === 'en' ? 'Sign in' : 'Đăng nhập', level: 1 }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', {
          name: locale === 'en' ? 'Continue with Google' : 'Tiếp tục với Google',
        }),
      ).toBeVisible();
      await page.getByRole('button', { name: LABEL[locale].signIn, exact: true }).click();
      await expect(
        page.getByText(
          locale === 'en'
            ? 'Enter an email like name@example.com'
            : 'Nhập email dạng ten@example.com',
        ),
      ).toBeVisible();
      await expect(
        page.getByText(locale === 'en' ? 'Enter your password' : 'Nhập mật khẩu của bạn'),
      ).toBeVisible();
    });

    test('Apple is off: no button, nothing shifts', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('button', { name: /Apple/ })).toHaveCount(0);
    });

    test('INVALID_CREDENTIALS', async ({ page }) => {
      await login(page, locale, newEmail(), PASSWORD);
      await expect(alertOf(page)).toHaveText(
        locale === 'en'
          ? "That email and password don't match. Check both and try again."
          : 'Email hoặc mật khẩu chưa đúng. Bạn kiểm tra lại nhé.',
      );
      // What was typed stays; the password never comes back.
      await expect(page.getByLabel('Email')).not.toHaveValue('');
      await expect(page.getByLabel(LABEL[locale].password, { exact: true })).toHaveValue('');
    });

    test('ACCOUNT_LOCKED until a time', async ({ page }) => {
      const { email, id } = await createAccount();
      const until = new Date(Date.now() + 3 * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');
      await api(`/admin/users/${id}/lock`, {
        method: 'POST',
        token: await adminToken(),
        body: JSON.stringify({ reason: 'e2e', lockedUntil: until }),
      });
      await login(page, locale, email, PASSWORD);
      await expect(alertOf(page)).toHaveText(
        locale === 'en'
          ? /^This account is locked until \d\d:\d\d, \d{1,2} \w{3}\. You can sign in again after that\.$/
          : /^Tài khoản đang bị khóa đến \d\d:\d\d, \d\d\/\d\d\. Sau thời gian đó bạn có thể đăng nhập lại\.$/,
      );
    });

    test('ACCOUNT_LOCKED by an admin, no end', async ({ page }) => {
      const { email, id } = await createAccount();
      await api(`/admin/users/${id}/lock`, {
        method: 'POST',
        token: await adminToken(),
        body: JSON.stringify({ reason: 'e2e' }),
      });
      await login(page, locale, email, PASSWORD);
      await expect(alertOf(page)).toHaveText(
        locale === 'en'
          ? 'This account is locked until an admin unlocks it. Ask at the counter.'
          : 'Tài khoản đang bị khóa cho đến khi quản trị viên mở khóa. Bạn hỏi nhân viên tại quầy nhé.',
      );
    });

    test('ACCOUNT_DEACTIVATED', async ({ page }) => {
      const { email, id } = await createAccount();
      await api(`/admin/users/${id}`, { method: 'DELETE', token: await adminToken() });
      await login(page, locale, email, PASSWORD);
      await expect(alertOf(page)).toHaveText(
        locale === 'en'
          ? 'This account has been deactivated. Ask at the counter if you think this is a mistake.'
          : 'Tài khoản này đã bị vô hiệu hóa. Nếu bạn nghĩ có nhầm lẫn, hãy hỏi nhân viên tại quầy.',
      );
    });

    test('RATE_LIMITED after the tenth attempt', async ({ page }) => {
      const email = newEmail();
      await exhaustEmailBucket(email);
      await login(page, locale, email, PASSWORD);
      await expect(alertOf(page)).toHaveText(
        locale === 'en'
          ? /^Too many attempts\. Try again in \d+ minutes?\.$/
          : /^Bạn thử quá nhiều lần\. Thử lại sau \d+ phút nhé\.$/,
      );
    });

    test('submitting: the button is busy and cannot be pressed twice', async ({ page }) => {
      await page.route('**/login', async (route) => {
        if (route.request().method() === 'POST') await new Promise((r) => setTimeout(r, 1500));
        await route.continue();
      });
      await page.goto('/login');
      await page.getByLabel(LABEL[locale].email).fill(newEmail());
      await page.getByLabel(LABEL[locale].password, { exact: true }).fill(PASSWORD);
      await page.getByRole('button', { name: LABEL[locale].signIn, exact: true }).click();
      await expect(
        page.getByRole('button', { name: locale === 'en' ? 'Signing in…' : 'Đang đăng nhập…' }),
      ).toBeDisabled();
    });
  });

  test.describe(`/register states — ${locale}`, () => {
    test.beforeEach(async ({ page }) => setLocale(page, locale));

    test('EMAIL_TAKEN offers the way to sign in', async ({ page }) => {
      const { email } = await createAccount();
      await registerWith(page, locale, email, PASSWORD);
      await expect(alertOf(page)).toContainText(
        locale === 'en' ? 'This email already has an account.' : 'Email này đã có tài khoản.',
      );
      await expect(
        alertOf(page).getByRole('link', {
          name: locale === 'en' ? /Sign in instead/ : /Đăng nhập/,
        }),
      ).toBeVisible();
    });

    test('a password under 8 characters', async ({ page }) => {
      await registerWith(page, locale, newEmail(), 'a'.repeat(7));
      await expect(
        page.getByText(locale === 'en' ? 'Use 8 or more characters.' : 'Dùng từ 8 ký tự trở lên.'),
      ).toBeVisible();
    });

    test('a password over 72 bytes (bytes, not characters)', async ({ page }) => {
      await registerWith(page, locale, newEmail(), 'ệ'.repeat(25)); // 25 characters, 75 bytes
      await expect(
        page.getByText(
          locale === 'en'
            ? 'That password is too long — try a shorter one.'
            : 'Mật khẩu quá dài — bạn thử mật khẩu ngắn hơn nhé.',
        ),
      ).toBeVisible();
    });

    test('RATE_LIMITED after the tenth attempt', async ({ page }) => {
      const email = newEmail();
      await exhaustEmailBucket(email);
      await registerWith(page, locale, email, PASSWORD);
      await expect(alertOf(page)).toContainText(
        locale === 'en' ? 'Too many attempts.' : 'Bạn thử quá nhiều lần.',
      );
    });

    test('submitting: the button is busy', async ({ page }) => {
      await page.route('**/register', async (route) => {
        if (route.request().method() === 'POST') await new Promise((r) => setTimeout(r, 1500));
        await route.continue();
      });
      await registerWith(page, locale, newEmail(), PASSWORD);
      await expect(
        page.getByRole('button', {
          name: locale === 'en' ? 'Creating account…' : 'Đang tạo tài khoản…',
        }),
      ).toBeDisabled();
    });
  });
}

test('Google: closing the popup without choosing returns to the form with no error', async ({
  page,
}) => {
  await page.goto('/login');
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  const window = await popup;
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeDisabled(); // the popup is open
  await window.close();
  // Firebase notices a closed popup by polling, a few seconds later.
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled({
    timeout: 20_000,
  });
  await expect(alertOf(page)).toHaveCount(0);
});

test('every state of the sign-in page is announced politely (field messages are live regions)', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.locator('[aria-live="polite"]').filter({ hasText: 'Enter your password' }),
  ).toBeVisible();
});
