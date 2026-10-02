import { createZodDto } from '@brewlite/nest-common';
import { LOYALTY_KINDS } from '@brewlite/contracts';
import { z } from 'zod';

export const loyaltyTransactionEntrySchema = z.object({
  orderId: z.string(),
  orderNo: z.string(),
  kind: z.enum(LOYALTY_KINDS),
  points: z.number(),
  at: z.string(),
});

export const loyaltyResponseSchema = z.object({
  balance: z.number(),
  lifetimeEarned: z.number(),
  recent: z.array(loyaltyTransactionEntrySchema),
});
export class LoyaltyResponseDto extends createZodDto(loyaltyResponseSchema) {}
