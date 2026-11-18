import type { BrowserContext, Page } from '@playwright/test';
import { lineKey } from '../../src/lib/cart/cart';
import { adminToken, api, productDetail, publicMenu, staffProducts, staffToken } from '../support';

/** Every customer state but the hero's four loads with the hero dismissed (handoff §3.6). */
export async function heroDismissed(context: BrowserContext, baseURL: string) {
  await context.addCookies([{ name: 'bl_hero', value: 'dismissed', url: baseURL }]);
}
/** `-vi` states set the language before load (handoff §3.5). */
export async function vietnamese(context: BrowserContext, baseURL: string) {
  await context.addCookies([{ name: 'bl_locale', value: 'vi', url: baseURL }]);
}

/** A seeded product by its English name — the screens draw the seeded menu as it is. */
export async function seeded(name: string) {
  const { products } = await publicMenu();
  const found = products.find((p) => p.name.en === name);
  if (!found) throw new Error(`the seed has no product named "${name}"`);
  return productDetail(found.id);
}

export interface LineSpec {
  /** A seeded product's English name. */
  product: string;
  size: string;
  /** Seeded topping names, English. */
  toppings?: string[];
  quantity?: number;
}

/**
 * Cart lines (`bl_cart`) exactly as a frame draws them: seeded products by name, in the frame's
 * size, with its toppings and quantity — so names, prices and the no-photo looks draw true.
 */
export async function cartLines(specs: LineSpec[]) {
  const { categories, products } = await publicMenu();
  const lines = [];
  for (const spec of specs) {
    const product = products.find((p) => p.name.en === spec.product);
    if (!product) throw new Error(`the seed has no product named "${spec.product}"`);
    const detail = await productDetail(product.id);
    const size = detail.sizes.find((s) => s.size === spec.size);
    if (!size) throw new Error(`${spec.product} has no size ${spec.size}`);
    const toppings = (spec.toppings ?? []).map((name) => {
      const t = detail.toppings.find((x) => x.name.en === name);
      if (!t) throw new Error(`${spec.product} offers no topping "${name}"`);
      return { id: t.id, name: t.name, priceVnd: t.priceVnd };
    });
    lines.push({
      key: lineKey(
        product.id,
        size.size,
        toppings.map((t) => t.id),
      ), // the app's own key
      productId: product.id,
      categoryId: product.categoryId,
      noPhoto:
        Math.max(
          0,
          categories.findIndex((c) => c.id === product.categoryId),
        ) % 5,
      name: product.name,
      imageUrl: product.imageUrl,
      size: size.size,
      basePriceVnd: detail.basePriceVnd,
      sizeDeltaVnd: size.priceDeltaVnd,
      toppings,
      quantity: spec.quantity ?? 1,
    });
  }
  return JSON.stringify({ v: 1, lines });
}

/** `count` distinct lines from the seeded menu, the frame's lines first (the 20-line cart). */
/** `first`, then other seeded product × size lines up to `count`; never one in `avoid`. */
export async function fillCart(first: LineSpec[], count: number, avoid: LineSpec[] = []) {
  const { products } = await publicMenu();
  const taken = new Set([...first, ...avoid].map((l) => `${l.product}|${l.size}`));
  const rest: LineSpec[] = [];
  for (const p of products.filter((x) => !x.isSoldOut)) {
    const detail = await productDetail(p.id);
    for (const s of detail.sizes) {
      if (first.length + rest.length >= count) break;
      if (!taken.has(`${p.name.en}|${s.size}`)) rest.push({ product: p.name.en, size: s.size });
    }
  }
  return cartLines([...first, ...rest].slice(0, count));
}

/** Writes `bl_cart` once, before the app loads (an init script would rewrite it on every load). */
export async function withCart(page: Page, cart: string) {
  await page.goto('/offline');
  await page.evaluate((value) => localStorage.setItem('bl_cart', value), cart);
}

/** Every product switched off through the staff API; each put back as it was, whatever happens. */
export async function withAllSoldOut<T>(body: () => Promise<T>): Promise<T> {
  const token = await staffToken();
  const before = await staffProducts();
  const set = (id: string, isAvailable: boolean) =>
    api(`/staff/products/${id}/availability`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ isAvailable }),
    });
  for (const p of before) if (p.isAvailable) await set(p.id, false);
  try {
    return await body();
  } finally {
    for (const p of before) if (p.isAvailable) await set(p.id, true);
  }
}

/** A fixed test photo on one product (admin API), cleared afterwards whatever happens. */
export async function withPhoto<T>(productId: string, png: Buffer, body: () => Promise<T>) {
  const token = await adminToken();
  const gateway = process.env.E2E_GATEWAY_URL ?? 'http://localhost:23100/api/v1';
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'photo.png');
  const upload = await fetch(`${gateway}/admin/products/${productId}/image`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (upload.status !== 200) throw new Error(`photo upload answered ${upload.status}`);
  try {
    return await body();
  } finally {
    await api(`/admin/products/${productId}/image`, { method: 'DELETE', token });
  }
}

/**
 * Holds the page's 5-second timers — the toast's (`SHOW_FOR_MS`) and the cart's Undo row
 * (`UNDO_MS`) — so a row can check and draw them however long that takes. Only those: pausing the
 * page clock would also freeze axe's and the screenshot's own timers. Install before loading.
 */
export async function holdFiveSecondTimers(page: Page) {
  await page.addInitScript(() => {
    const original = window.setTimeout;
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) =>
      delay === 5000 ? 0 : original(handler, delay, ...args)) as typeof window.setTimeout;
  });
}
