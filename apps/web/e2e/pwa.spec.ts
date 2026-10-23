import { expect, test } from './support';

test('the manifest carries the brand', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({
    name: 'BrewLite',
    short_name: 'BrewLite',
    start_url: '/',
    display: 'standalone',
    theme_color: '#6B3A1F',
    background_color: '#FFFCF7',
  });
  const icons = manifest.icons as { src: string; sizes: string; purpose?: string }[];
  expect(icons.map((i) => i.src)).toEqual([
    '/icon-192.png',
    '/icon-512.png',
    '/icon-maskable-512.png',
  ]);
  expect(icons.find((i) => i.src === '/icon-maskable-512.png')?.purpose).toBe('maskable');
});

test('the worker activates, serves the offline page, and caches no page or API data', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in' }).click(); // another page, to be sure it is not cached
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) throw new Error('no active worker');
  });
  // The worker claims the page on activation; reload so the next navigation goes through it.
  await page.reload();
  await page.evaluate(() => fetch('/api/v1/menu').catch(() => undefined));

  const urls = await page.evaluate(async () => {
    const out: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys())
        out.push(new URL(request.url).pathname);
    }
    return out;
  });
  expect(urls).toContain('/offline');
  for (const path of urls) {
    expect(path).toMatch(
      /^\/(_next\/static\/|offline$|icon-|favicon|logo|symbol|apple-touch-icon)/,
    );
    expect(path).not.toMatch(/^\/(api|login|register)/);
  }

  await context.setOffline(true);
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
  // offline header: logo and language switch only
  await expect(page.getByRole('link', { name: 'Cart' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tiếng Việt' }).click();
  await expect(page.getByRole('heading', { name: 'Bạn đang mất kết nối' })).toBeVisible();
  await context.setOffline(false);
});

test('404 and the 500 page', async ({ page }) => {
  await page.goto('/nope');
  await expect(page.getByRole('heading', { name: "This page isn't on the menu" })).toBeVisible();
  await page.getByRole('link', { name: 'Back to menu' }).last().click();
  await expect(page).toHaveURL(/\/$/);
});
