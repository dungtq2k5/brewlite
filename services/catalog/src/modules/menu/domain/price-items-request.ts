import { z } from 'zod';
import { MAX_LINES_PER_ORDER, MAX_QTY_PER_LINE, PRODUCT_SIZES, zUuidV7 } from '@brewlite/contracts';

const zCartLine = z.object({
  productId: zUuidV7,
  size: z.enum(PRODUCT_SIZES),
  toppingIds: z.array(zUuidV7),
  qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
});

export const zPriceItemsRequest = z.object({
  lines: z.array(zCartLine).min(1).max(MAX_LINES_PER_ORDER),
});

export type PriceItemsRequestInput = z.infer<typeof zPriceItemsRequest>;

/** RFC 6901: `''` for the root; each segment escapes `~` → `~0` and `/` → `~1`. Mirrors the gateway's own (error.filter.ts) — the same `{ path, code }` shape crosses both boundaries. */
export function toJsonPointer(path: readonly PropertyKey[]): string {
  if (path.length === 0) return '';
  return `/${path.map((segment) => String(segment).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`;
}
