import { expect, type Page } from '@playwright/test';
import { newId } from '@brewlite/contracts';

/** Meets the shared password byte-length rule and is only used against the dev stack. */
export const E2E_PASSWORD = 'BrewLite-e2e-2026';

interface ProductSummary {
  id: string;
  isSoldOut: boolean;
}

interface OrderSummary {
  id: string;
  status: string;
  currentPaymentId: string | null;
}

interface PaymentSummary {
  id: string;
}

/**
 * Registers a fresh customer through the real login page, so the suite exercises
 * the server action and the httpOnly session cookies instead of planting a token.
 * A new id in the address keeps parallel runs and repeated local runs isolated.
 */
export async function registerCustomer(page: Page): Promise<string> {
  const email = `e2e-${newId()}@brewlite.test`;

  await page.goto('/login');
  await page.getByRole('tab', { name: 'Đăng ký' }).click();
  await page.getByLabel('Họ tên').fill('E2E Customer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();

  await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });
  await expect(page.getByRole('navigation', { name: 'Điều hướng khách hàng' })).toBeVisible();

  return email;
}

/**
 * Places a PENDING order through the same gateway route the checkout server
 * action calls. Payment UI is what these specs drive; catalog and cart UI are
 * covered elsewhere, so this keeps order setup deterministic.
 */
export async function createPendingOrder(page: Page): Promise<OrderSummary> {
  const productsResponse = await page.request.get('/api/v1/products');
  expect(productsResponse.ok(), await productsResponse.text()).toBe(true);

  const productsBody = (await productsResponse.json()) as { data?: ProductSummary[] };
  const product = productsBody.data?.find((item) => !item.isSoldOut);
  if (!product) throw new Error('The catalog has no available product to order');

  const response = await page.request.post('/api/v1/orders', {
    headers: { 'Idempotency-Key': newId() },
    data: { items: [{ productId: product.id, size: 'S', toppingIds: [], qty: 1 }] },
  });
  expect([200, 201]).toContain(response.status());

  const body = (await response.json()) as { data?: OrderSummary };
  if (!body.data) throw new Error('The gateway returned no order');

  return body.data;
}

/** Opens a fake-provider payment session for an order, as the order page does. */
export async function createPayment(page: Page, orderId: string): Promise<PaymentSummary> {
  const response = await page.request.post('/api/v1/payments', {
    headers: { 'Idempotency-Key': newId() },
    data: { orderId },
  });
  expect([200, 201]).toContain(response.status());

  const body = (await response.json()) as { data?: PaymentSummary };
  if (!body.data) throw new Error('The gateway returned no payment');

  return body.data;
}

/** Reads the order back from the gateway; payment events reach ordering asynchronously. */
export async function readOrder(page: Page, orderId: string): Promise<OrderSummary> {
  const response = await page.request.get(`/api/v1/orders/${orderId}`);
  expect(response.ok(), await response.text()).toBe(true);

  const body = (await response.json()) as { data?: OrderSummary };
  if (!body.data) throw new Error('The gateway returned no order');

  return body.data;
}

/** Reads the order status back to prove a status change is persisted. */
export async function readOrderStatus(page: Page, orderId: string): Promise<string> {
  return (await readOrder(page, orderId)).status;
}
