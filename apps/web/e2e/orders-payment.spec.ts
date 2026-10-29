import { expect, test } from '@playwright/test';
import { newId } from '@brewlite/contracts';
import {
  createPayment,
  createPendingOrder,
  readOrder,
  readOrderStatus,
  registerCustomer,
} from './support/customer';

test.describe('customer order payment', () => {
  test('resumes a pending order and reaches PAID through the fake provider', async ({ page }) => {
    await registerCustomer(page);
    const order = await createPendingOrder(page);

    await page.goto(`/orders/${order.id}`);
    await expect(page.locator('.order-status')).toHaveText('Chờ thanh toán');

    // No payment exists yet: the page offers to open the one payment session.
    await page.getByRole('button', { name: 'Mở thanh toán' }).click();
    await expect(page).toHaveURL(
      (url) => url.pathname === `/orders/${order.id}` && url.searchParams.has('payment'),
      { timeout: 30_000 },
    );
    await expect(page.getByLabel('Số thẻ')).toHaveValue('4242 4242 4242 4242');

    await page.getByRole('button', { name: /^Thanh toán / }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Thanh toán thành công' })).toBeVisible(
      { timeout: 30_000 },
    );
    await expect(page.locator('.order-status')).toHaveText('Đã thanh toán', { timeout: 30_000 });

    // The page update and the persisted order must agree.
    await expect.poll(() => readOrderStatus(page, order.id), { timeout: 30_000 }).toBe('PAID');
  });

  test('falls back to the current payment when the ?payment id is stale, then recovers from a failed attempt', async ({
    page,
  }) => {
    await registerCustomer(page);
    const order = await createPendingOrder(page);
    const payment = await createPayment(page, order.id);
    await expect
      .poll(async () => (await readOrder(page, order.id)).currentPaymentId, { timeout: 30_000 })
      .toBe(payment.id);

    const stalePaymentId = newId();
    await page.goto(`/orders/${order.id}?payment=${stalePaymentId}`);

    // The stale id is ignored and the order's currentPaymentId mounts the card form.
    await expect(page.getByLabel('Số thẻ')).toHaveValue('4242 4242 4242 4242');

    await page.getByLabel('Số thẻ').fill('4000 0000 0000 0002');
    await page.getByRole('button', { name: /^Thanh toán / }).click();
    await expect(page.locator('.order-status')).toHaveText('Thanh toán lỗi', { timeout: 30_000 });
    await expect(page.locator('.panel-head .tag')).toHaveText('Thanh toán thất bại');

    // A failed session can be replaced; the stale query must not survive the retry.
    await page.getByRole('button', { name: 'Tạo thanh toán mới' }).click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === `/orders/${order.id}` &&
        url.searchParams.get('payment') !== stalePaymentId,
      { timeout: 30_000 },
    );
    await page.getByRole('button', { name: /^Thanh toán / }).click();
    await expect(page.locator('.order-status')).toHaveText('Đã thanh toán', { timeout: 30_000 });
    await expect.poll(() => readOrderStatus(page, order.id), { timeout: 30_000 }).toBe('PAID');
  });

  test('sends a guest to login with the order as the next path', async ({ page }) => {
    const orderId = newId();

    await page.goto(`/orders/${orderId}`);

    await page.waitForURL(
      (url) => url.pathname === '/login' && url.searchParams.get('next') === `/orders/${orderId}`,
    );
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  });
});
