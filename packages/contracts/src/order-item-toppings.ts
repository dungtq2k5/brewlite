import { z } from 'zod';
import { MAX_TOPPINGS_PER_LINE } from './constants.js';
import { zUuidV7 } from './ids.js';

/** O-2 `toppings` — a snapshot, owned whole by this schema (rdm-spec §2.5). */
export const zOrderItemTopping = z.object({
  toppingId: zUuidV7,
  nameEn: z.string(),
  nameVi: z.string(),
  priceVnd: z.number().int().nonnegative(),
});

export const zOrderItemToppings = z.array(zOrderItemTopping).max(MAX_TOPPINGS_PER_LINE);

export type OrderItemTopping = z.infer<typeof zOrderItemTopping>;
export type OrderItemToppings = z.infer<typeof zOrderItemToppings>;
