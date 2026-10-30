import { z } from 'zod';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  ORDER_STATUSES,
  zBusinessDay,
} from '@brewlite/contracts';

/** The columns an admin can sort the order list by (api-endpoints-plan §3.4). */
export const ORDER_SORT_FIELDS = ['createdAt', 'totalVnd'] as const;
export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

const SORTS = [...ORDER_SORT_FIELDS, ...ORDER_SORT_FIELDS.map((f) => `-${f}`)] as [
  string,
  ...string[],
];

/** What the gateway sends; proto3 leaves a missing int `0` and a missing string `''`. */
export interface RawListOrders {
  page?: { page: number; pageSize: number; sort: string };
  status?: string;
  from?: string;
  to?: string;
  orderNo?: string;
}

const zListOrders = z
  .object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE),
    sort: z.enum(SORTS),
    status: z.enum(ORDER_STATUSES).optional(),
    from: zBusinessDay.optional(),
    to: zBusinessDay.optional(),
    // int64 as a string (conventions §5.1); 18 digits stays inside a JS-safe BigInt round trip.
    orderNo: z
      .string()
      .regex(/^[1-9]\d{0,17}$/)
      .optional(),
  })
  .refine((q) => q.from === undefined || q.to === undefined || q.from <= q.to, {
    message: 'from is after to',
    path: ['from'],
  });

export type ListOrdersQuery = z.infer<typeof zListOrders> & {
  sortField: OrderSortField;
  descending: boolean;
};

/** The proto's empty defaults become the route's defaults; anything else out of range is refused. */
export function parseListOrders(raw: RawListOrders) {
  const result = zListOrders.safeParse({
    page: raw.page?.page || 1,
    pageSize: raw.page?.pageSize || DEFAULT_PAGE_SIZE,
    sort: raw.page?.sort || '-createdAt',
    status: raw.status,
    from: raw.from,
    to: raw.to,
    orderNo: raw.orderNo,
  });
  if (!result.success) return result;
  const descending = result.data.sort.startsWith('-');
  return {
    success: true as const,
    data: {
      ...result.data,
      descending,
      sortField: (descending ? result.data.sort.slice(1) : result.data.sort) as OrderSortField,
    } satisfies ListOrdersQuery,
  };
}

/** RFC 6901, as the gateway writes it — the same `{ path, code }` crosses both boundaries. */
export function toJsonPointer(path: readonly PropertyKey[]): string {
  if (path.length === 0) return '';
  return `/${path.map((s) => String(s).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`;
}
