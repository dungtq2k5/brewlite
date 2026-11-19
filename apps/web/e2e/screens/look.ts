import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';
import { isSkipped, STATES, VIEWPORT, type Width } from './states';

export interface LookOptions {
  /** The row's own masks, beyond the generic set. */
  mask?: Locator[];
  /** Axe rules this row turns off — each with its reason beside the call. Nothing is off globally. */
  disabled?: string[];
  /** Keep the page's scroll position (a scrolled state) instead of drawing from the top. */
  keepScroll?: boolean;
  /** Run after each resize, before the checks — to put back a state the new layout moved. */
  atWidth?: (width: Width) => Promise<void>;
}

/**
 * Checks a state the row has driven the page into, then draws it: for each width of
 * the state, the page is resized **in place** — the same state, no reload — checked for sideways
 * scroll and by axe (any `serious` or `critical` violation fails, colour contrast included), then
 * compared with its baseline `<state-id>@<width>.png`. A frame taller than its viewport means the
 * full page (handoff §3.4), drawn as a viewport as tall as the page.
 *
 * Masked everywhere: `data-variable` (the components whose content varies run to run — a mask
 * hook only, never an assertion selector) and `time`; plus the row's own.
 *
 * @example await look(page, 'customer-menu-guest');
 */
export async function look(page: Page, id: string, options: LookOptions = {}): Promise<void> {
  const state = STATES[id];
  if (!state || isSkipped(state))
    throw new Error(`look(): ${id} is not a drawn state in states.ts`);
  const initial = page.viewportSize();
  try {
    for (const [key, frame] of Object.entries(state.widths)) {
      const width = Number(key) as Width;
      const viewport = VIEWPORT[width];
      await page.setViewportSize(viewport);
      await settled(page);
      if (options.atWidth) await options.atWidth(width);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${id}@${width} scrolls sideways`,
      ).toBeLessThanOrEqual(viewport.width);
      await accessible(page, `${id}@${width}`, options.disabled ?? []);
      const tall = (frame?.frame ?? viewport.height) > viewport.height;
      if (!options.keepScroll) await page.evaluate(() => window.scrollTo(0, 0));
      // A tall frame is drawn as one tall screen, so a sticky or fixed bar sits at its foot as in
      // the frame — a full-page capture would paint it at the first viewport's bottom instead.
      if (tall && !options.keepScroll) {
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.setViewportSize({
          width: viewport.width,
          height: Math.max(height, viewport.height),
        });
      }
      await settled(page);
      await expect(page).toHaveScreenshot(`${id}@${width}.png`, {
        fullPage: tall && !!options.keepScroll,
        mask: [page.locator('[data-variable]'), page.locator('time'), ...(options.mask ?? [])],
      });
    }
  } finally {
    if (initial) await page.setViewportSize(initial);
  }
}

/**
 * Fonts loaded, then a moment for layout after a resize or a scroll. Waited on this side, never on
 * the page's timers or `requestAnimationFrame`: a row that pauses the page's clock (to hold a
 * toast) freezes those, and the wait would never end.
 */
async function settled(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(100);
}

async function accessible(page: Page, name: string, disabled: string[]) {
  const { violations } = await new AxeBuilder({ page }).disableRules(disabled).analyze();
  const serious = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(serious, `${name}: serious or critical accessibility violations`).toEqual([]);
}
