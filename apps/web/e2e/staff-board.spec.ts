import type { Browser, Page } from '@playwright/test';
import {
  advance,
  expect,
  fakeProviderIsOn,
  orderNoOn,
  payWithFake,
  placeOrderAsNewCustomer,
  seedPassword,
  signIn,
  staffTablet,
  statusOf,
  test,
  userToken,
} from './support';

// The counter tablet (1024 × 768). Fake provider only — skipped on Stripe like the payment specs.
test.use({ viewport: { width: 1024, height: 768 }, hasTouch: false, isMobile: false });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bl_install_dismissed', '1'));
});

const column = (page: Page, name: 'Paid' | 'Preparing' | 'Ready') =>
  page.getByRole('region', { name: new RegExp(`^${name}`) });

/** A customer places an order and pays it; the customer page stays open as `page`. */
async function paidOrder(customer: Page) {
  const placed = await placeOrderAsNewCustomer(customer);
  test.skip(!(await fakeProviderIsOn(customer)), 'payment runs with Stripe, not the fake provider');
  await payWithFake(customer);
  return { ...placed, no: await orderNoOn(customer) };
}

async function openBoard(browser: Browser) {
  return staffTablet(browser);
}

test('a paid order appears on the board without a reload, marked New', async ({
  page,
  browser,
}) => {
  const { page: staff, context } = await openBoard(browser);
  try {
    await expect(staff.getByText('Live', { exact: true })).toBeVisible();
    const { no } = await paidOrder(page);
    const card = column(staff, 'Paid')
      .getByRole('listitem')
      .filter({ hasText: `#${no}` })
      .or(column(staff, 'Paid').getByRole('img', { name: `Order ${no}` }));
    await expect(card.first()).toBeVisible();
    await expect(column(staff, 'Paid').getByText('New', { exact: true })).toBeVisible();
    await expect(staff.getByRole('status').filter({ hasText: `New order #${no}` })).toBeAttached();
  } finally {
    await context.close();
  }
});

test('Start, Ready with Undo, Ready left to send, Collected — and the customer follows', async ({
  page,
  browser,
}) => {
  const { orderId, email, no } = await paidOrder(page);
  const token = await userToken(email);
  const { page: staff, context } = await openBoard(browser);
  try {
    await expect(staff.getByRole('button', { name: `Start #${no}` })).toBeVisible();

    // Start is sent at once.
    await staff.getByRole('button', { name: `Start #${no}` }).click();
    await expect(
      column(staff, 'Preparing').getByRole('img', { name: `Order ${no}` }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Brewing' })).toBeVisible();

    // Ready, then Undo inside five seconds: the card is back and nothing reached the customer.
    await staff.getByRole('button', { name: `Ready #${no}` }).click();
    await expect(column(staff, 'Ready').getByRole('img', { name: `Order ${no}` })).toBeVisible();
    await expect(staff.getByText(`#${no} marked Ready`)).toBeVisible();
    await staff.getByRole('button', { name: /^Undo/ }).click();
    await expect(
      column(staff, 'Preparing').getByRole('img', { name: `Order ${no}` }),
    ).toBeVisible();
    await staff.waitForTimeout(5500);
    expect((await statusOf(orderId, token)).status).toBe('PREPARING');

    // Ready left alone is sent when the five seconds end.
    await staff.getByRole('button', { name: `Ready #${no}` }).click();
    expect((await statusOf(orderId, token)).status).toBe('PREPARING');
    await expect(page.getByRole('alert').filter({ hasText: 'is ready' })).toBeVisible({
      timeout: 15_000,
    });
    expect((await statusOf(orderId, token)).status).toBe('READY');

    // Collected leaves the board.
    await staff.getByRole('button', { name: `Collected #${no}` }).click();
    await expect(staff.getByText(`#${no} marked Collected`)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Collected — enjoy!' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(staff.getByRole('img', { name: `Order ${no}` })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('a second tablet follows every move, and moving the same order on both is a quiet line', async ({
  page,
  browser,
}) => {
  const { no } = await paidOrder(page);
  const a = await openBoard(browser);
  const b = await openBoard(browser);
  try {
    await expect(column(a.page, 'Paid').getByRole('img', { name: `Order ${no}` })).toBeVisible();
    await expect(column(b.page, 'Paid').getByRole('img', { name: `Order ${no}` })).toBeVisible();

    // Tablet B stops hearing the stream, so it is still showing the card in Paid when A starts it.
    await b.page.route('**/api/events/staff', (route) => route.abort());
    await a.page.getByRole('button', { name: `Start #${no}` }).click();
    await expect(
      column(a.page, 'Preparing').getByRole('img', { name: `Order ${no}` }),
    ).toBeVisible();

    await b.page.getByRole('button', { name: `Start #${no}` }).click();
    await expect(b.page.getByText('Already moved by someone else')).toBeVisible();
    await expect(
      column(b.page, 'Preparing').getByRole('img', { name: `Order ${no}` }),
    ).toBeVisible();
    await expect(b.page.getByText('Already moved by someone else')).toBeHidden({ timeout: 10_000 });

    // And a tablet that is listening follows within a second or two.
    await b.page.unroute('**/api/events/staff');
    await a.page.getByRole('button', { name: `Ready #${no}` }).click();
    await expect(column(b.page, 'Ready').getByRole('img', { name: `Order ${no}` })).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test('cancel with a quick pick: the customer sees the reason and a refund', async ({
  page,
  browser,
}) => {
  const { orderId, email, no } = await paidOrder(page);
  const token = await userToken(email);
  const { page: staff, context } = await openBoard(browser);
  try {
    await staff.getByRole('button', { name: `Cancel #${no}…` }).click();
    const dialog = staff.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: new RegExp(`Cancel #${no}`) })).toBeVisible();
    const confirm = dialog.getByRole('button', { name: 'Cancel and refund' });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole('button', { name: 'Machine broken' }).click();
    await expect(dialog.getByLabel(/^Reason/)).toHaveValue('Machine broken');
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(staff.getByText(`#${no} cancelled — the refund is on its way.`)).toBeVisible();
    await expect(staff.getByRole('img', { name: `Order ${no}` })).toHaveCount(0);
    const order = await statusOf(orderId, token);
    expect(order.status).toBe('CANCELLED');
    expect(order.cancelNote).toBe('Machine broken');
    expect(['PENDING', 'REFUNDED']).toContain(order.refundStatus);
    await expect(page.getByText('Machine broken')).toBeVisible({ timeout: 15_000 });
  } finally {
    await context.close();
  }
});

test('cancelling an order the other tablet already started is refused', async ({
  page,
  browser,
}) => {
  const { orderId, no } = await paidOrder(page);
  const { page: staff, context } = await openBoard(browser);
  try {
    await staff.getByRole('button', { name: `Cancel #${no}…` }).click();
    const dialog = staff.getByRole('dialog');
    await dialog.getByLabel(/^Reason/).fill('Closing early');
    await advance(orderId, 'PREPARING'); // the other tablet
    await dialog.getByRole('button', { name: 'Cancel and refund' }).click();
    await expect(dialog.getByText("It's being made now — it can't be cancelled.")).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(
      column(staff, 'Preparing').getByRole('img', { name: `Order ${no}` }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test('a customer placing an order, not yet paid, does not refresh the board', async ({
  page,
  browser,
}) => {
  const { page: staff, context } = await openBoard(browser);
  try {
    await expect(staff.getByText('Live', { exact: true })).toBeVisible();
    await staff.waitForTimeout(1000);
    let refreshes = 0;
    staff.on('request', (request) => {
      if (request.headers()['rsc'] === '1' && new URL(request.url()).pathname === '/staff')
        refreshes += 1;
    });
    await placeOrderAsNewCustomer(page); // PENDING: placed, payment started, not paid
    await page.waitForTimeout(3000);
    expect(refreshes).toBe(0);
  } finally {
    await context.close();
  }
});

test('sound is off until enabled, and the choice is remembered', async ({ browser }) => {
  const { page: staff, context } = await openBoard(browser);
  try {
    const pill = staff.getByRole('button', { name: 'Enable sound' });
    await expect(pill).toHaveAttribute('aria-pressed', 'false');
    await pill.click();
    await expect(staff.getByRole('button', { name: 'Sound on' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await staff.reload();
    await expect(staff.getByRole('button', { name: 'Sound on' })).toBeVisible();
  } finally {
    await context.close();
  }
});

// The phone frame (85:6950): the title says *Orders*, the counts sit inside the tabs, there is no
// column header under them, and *Live* is on the right, before the sound pill.
test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the title, the tab counts and the live badge follow the phone frame', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    try {
      await signIn(page, 'staff@brewlite.test', seedPassword());
      await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
      await page.goto('/staff');
      await expect(
        page.getByRole('heading', { name: 'Orders', level: 1, exact: true }),
      ).toBeVisible();

      const tab = page.getByRole('tab', { name: /^Paid\s*\d+$/ });
      await expect(tab).toBeVisible();
      await expect(tab.locator('span')).toHaveText(/^\d+$/); // the count is a pill inside the button
      await expect(page.getByRole('heading', { name: /^Paid\s*\d+$/, level: 2 })).toBeHidden();

      const live = page.getByText('Live', { exact: true });
      await expect(live).toBeVisible();
      const sound = page.getByRole('button', { name: /sound/i });
      expect((await live.boundingBox())!.x).toBeGreaterThan(
        (await page.getByRole('heading', { name: 'Orders', level: 1 }).boundingBox())!.x + 60,
      );
      expect((await live.boundingBox())!.x).toBeLessThan((await sound.boundingBox())!.x);
    } finally {
      await context.close();
    }
  });
});
