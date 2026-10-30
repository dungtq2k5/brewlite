import { createZodDto } from '@brewlite/nest-common';
import { ORDER_STATUSES, zBusinessDay, zPageQuery, zUuidV7 } from '@brewlite/contracts';
import { z } from 'zod';
import { orderResponseSchema } from '../../orders/dto/order.dto.js';
import { paymentResponseSchema } from '../../payments/dto/payment.dto.js';

export const listAdminOrdersQuerySchema = zPageQuery(['createdAt', 'totalVnd'], '-createdAt')
  .extend({
    status: z.enum(ORDER_STATUSES).optional(),
    from: zBusinessDay.optional(),
    to: zBusinessDay.optional(),
    // A query string; the proto carries it as an int64 string (conventions §5.1).
    orderNo: z.coerce.number().int().positive().optional(),
  })
  .strict()
  .refine((q) => q.from === undefined || q.to === undefined || q.from <= q.to, {
    message: 'from is after to',
    path: ['from'],
  });
export class ListAdminOrdersQueryDto extends createZodDto(listAdminOrdersQuerySchema) {}

export const adminOrderIdParamSchema = z.object({ id: zUuidV7 }).strict();
export class AdminOrderIdParamDto extends createZodDto(adminOrderIdParamSchema) {}

/** `Order & { payments }` — `null` when payment could not be reached (`meta.degraded`). */
export const adminOrderDetailSchema = orderResponseSchema.extend({
  payments: z.array(paymentResponseSchema).nullable(),
});
export class AdminOrderDetailResponseDto extends createZodDto(adminOrderDetailSchema) {}

/** The one thing `meta` says on the detail route: a dependency was down and its field is `null`. */
export const ADMIN_ORDER_META_PROPERTIES = {
  degraded: { type: 'array', items: { type: 'string', enum: ['payment'] } },
} as const;
export type AdminOrderMeta = { degraded: 'payment'[] };
