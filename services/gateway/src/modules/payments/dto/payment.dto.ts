import { createZodDto } from '@brewlite/nest-common';
import { zUuidV7 } from '@brewlite/contracts';
import { z } from 'zod';

export const createPaymentSchema = z.object({ orderId: zUuidV7 }).strict();
export class CreatePaymentDto extends createZodDto(createPaymentSchema) {}

export const fakeConfirmSchema = z.object({ outcome: z.enum(['SUCCEEDED', 'FAILED']) }).strict();
export class FakeConfirmDto extends createZodDto(fakeConfirmSchema) {}

export const paymentIdParamSchema = z.object({ id: zUuidV7 }).strict();
export class PaymentIdParamDto extends createZodDto(paymentIdParamSchema) {}

// api §4 — `clientSecret` is present only while `PENDING` with provider `STRIPE`.
export const paymentResponseSchema = z.object({
  id: zUuidV7,
  orderId: zUuidV7,
  status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED']),
  provider: z.enum(['STRIPE', 'FAKE']),
  amountVnd: z.number().int(),
  method: z.string().nullable(),
  clientSecret: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
});
export class PaymentResponseDto extends createZodDto(paymentResponseSchema) {}
