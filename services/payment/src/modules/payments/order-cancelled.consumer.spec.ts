import { describe, expect, it, vi } from 'vitest';
import { newId, OrderActorType, OrderStatus, RefundReason } from '@brewlite/contracts';
import { PoisonMessage } from '@brewlite/nest-common';
import { OrderCancelledConsumer } from './order-cancelled.consumer.js';
import { PaymentRejectedConsumer } from './payment-rejected.consumer.js';

const changed = (from: OrderStatus, to: OrderStatus, paymentId?: string) => ({
  eventId: newId(),
  occurredAt: new Date().toISOString(),
  orderId: newId(),
  orderNo: '1042',
  userId: newId(),
  from,
  to,
  actorType: OrderActorType.STAFF,
  paymentId,
});

describe('OrderCancelledConsumer', () => {
  it('a paid cancel refunds the named payment as STAFF_CANCELLED', async () => {
    const refunds = { refund: vi.fn() };
    const paymentId = newId();
    await new OrderCancelledConsumer(refunds as never).handle(
      changed(OrderStatus.PAID, OrderStatus.CANCELLED, paymentId),
    );
    expect(refunds.refund).toHaveBeenCalledWith(paymentId, RefundReason.STAFF_CANCELLED);
  });

  it.each([
    [OrderStatus.PENDING, OrderStatus.CANCELLED],
    [OrderStatus.PAID, OrderStatus.PREPARING],
    [OrderStatus.PENDING, OrderStatus.PAID],
  ])('%s → %s is not a refund', async (from, to) => {
    const refunds = { refund: vi.fn() };
    await new OrderCancelledConsumer(refunds as never).handle(changed(from, to, newId()));
    expect(refunds.refund).not.toHaveBeenCalled();
  });

  it('a paid cancel with no paymentId is poison — never silently unrefunded', async () => {
    const refunds = { refund: vi.fn() };
    await expect(
      new OrderCancelledConsumer(refunds as never).handle(
        changed(OrderStatus.PAID, OrderStatus.CANCELLED),
      ),
    ).rejects.toBeInstanceOf(PoisonMessage);
  });
});

describe('PaymentRejectedConsumer', () => {
  it('refunds as ORDER_NOT_PAYABLE', async () => {
    const refunds = { refund: vi.fn() };
    const paymentId = newId();
    await new PaymentRejectedConsumer(refunds as never).handle({
      eventId: newId(),
      occurredAt: new Date().toISOString(),
      orderId: newId(),
      paymentId,
      orderStatus: OrderStatus.CANCELLED,
    });
    expect(refunds.refund).toHaveBeenCalledWith(paymentId, RefundReason.ORDER_NOT_PAYABLE);
  });
});
