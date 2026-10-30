'use server';

import {
  ordersControllerCancelOrder,
  ordersControllerListMyOrders,
  ordersControllerPlaceOrder,
  ordersControllerQuote,
  type OrderResponseDto,
  type OrdersControllerListMyOrders200Meta,
  type QuoteResponseDto,
} from '@brewlite/api-client';
import { ORDER_NOTE_MAX_LENGTH, type ProductSize } from '@brewlite/contracts';
import '@/lib/api';
import { toResult, type ActionResult } from '@/lib/action-result';

/** The wire's cart lines (`toQuoteItems`), always in the cart's order. */
export interface OrderItemsInput {
  items: { productId: string; size: ProductSize; toppingIds: string[]; qty: number }[];
  promoCode?: string;
  note?: string;
}

const body = ({ items, promoCode, note }: OrderItemsInput) =>
  ({
    items,
    ...(promoCode !== undefined && promoCode !== '' && { promoCode }),
    ...(note !== undefined &&
      note.trim() !== '' && { note: note.trim().slice(0, ORDER_NOTE_MAX_LENGTH) }),
  }) as Parameters<typeof ordersControllerPlaceOrder>[0];

/** Prices the cart on the server; writes and reserves nothing. */
export async function quoteCart(input: OrderItemsInput): Promise<ActionResult<QuoteResponseDto>> {
  const { items, promoCode } = input;
  const result = await toResult(() => ordersControllerQuote(body({ items, promoCode })));
  if (!result.ok) return result;
  const data = result.data.status === 200 ? result.data.data.data : undefined;
  return data ? { ok: true, data } : { ok: false, code: 'INTERNAL' };
}

/**
 * `201` a new order, `200` the same key replayed — both are an order. The key comes from the
 * client (generated at the tap and kept across retries), never from here.
 */
export async function placeOrder(
  input: OrderItemsInput,
  idempotencyKey: string,
): Promise<ActionResult<OrderResponseDto>> {
  const result = await toResult(() =>
    ordersControllerPlaceOrder(body(input), { headers: { 'Idempotency-Key': idempotencyKey } }),
  );
  if (!result.ok) return result;
  const response = result.data;
  const order = response.status === 200 || response.status === 201 ? response.data.data : undefined;
  return order ? { ok: true, data: order } : { ok: false, code: 'INTERNAL' };
}

export async function cancelOrder(id: string): Promise<ActionResult<OrderResponseDto>> {
  const result = await toResult(() => ordersControllerCancelOrder(id));
  if (!result.ok) return result;
  const order = result.data.status === 200 ? result.data.data.data : undefined;
  return order ? { ok: true, data: order } : { ok: false, code: 'INTERNAL' };
}

export interface OrdersPage {
  orders: OrderResponseDto[];
  nextCursor: OrdersControllerListMyOrders200Meta['nextCursor'];
}

export async function loadMoreOrders(cursor: string): Promise<ActionResult<OrdersPage>> {
  const result = await toResult(() => ordersControllerListMyOrders({ limit: 20, cursor }));
  if (!result.ok) return result;
  const response = result.data;
  if (response.status !== 200) return { ok: false, code: 'INTERNAL' };
  return {
    ok: true,
    data: { orders: response.data.data ?? [], nextCursor: response.data.meta?.nextCursor ?? null },
  };
}
