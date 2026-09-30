import type { EventPayload, OrderStatus } from '@brewlite/contracts';

/** What crosses to the browser — no user id, no amounts (api-endpoints-plan §5). */
export interface OrderStatusFrame {
  id: string;
  orderId: string;
  orderNo: number;
  status: OrderStatus;
  at: string;
}

/** `orderNo` is an int64 string on the wire between services and a JSON number here (api §0.5). */
export function toFrame(payload: EventPayload<'ordering.order.status_changed'>): OrderStatusFrame {
  const orderNo = Number(payload.orderNo);
  if (!Number.isSafeInteger(orderNo)) {
    throw new Error(`orderNo ${payload.orderNo} is not a safe integer`);
  }
  return {
    id: payload.eventId,
    orderId: payload.orderId,
    orderNo,
    status: payload.to,
    at: payload.occurredAt,
  };
}

export function formatFrame(frame: OrderStatusFrame): string {
  const data = JSON.stringify({
    orderId: frame.orderId,
    orderNo: frame.orderNo,
    status: frame.status,
    at: frame.at,
  });
  return `event: order.status\nid: ${frame.id}\ndata: ${data}\n\n`;
}
