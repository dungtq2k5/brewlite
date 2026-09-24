# 0019 — Order status changes only through the state machine, as conditional updates

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

An order's status is changed by the customer (cancel), by staff (preparing, ready, completed, cancel with refund), by payment events (paid, failed) and by the expiry job. These arrive concurrently and out of order: a payment can succeed in the same second the expiry job cancels the order; an event can be redelivered. Course Task 10 requires that illegal transitions are refused, with a test to prove it.

Checking the status in code and then writing it leaves a window for two writers to both pass the check.

## Decision

- The allowed transitions are **one table** in ordering's `domain/`, the one in product-overview §6.4. `assertTransition(from, to)` throws `INVALID_STATE` for any pair not in it.
- **Every status write is a conditional update**: `UPDATE orders SET status = $to, … WHERE id = $id AND status = $from`. Zero rows means someone else moved the order first → `409 INVALID_STATE` with the current status (or, for an event consumer, an acknowledged no-op).
- Each transition inserts an **`order_status_history`** row (from, to, actor type, actor id, reason) and an outbox `ordering.order.status_changed` event **in the same transaction**.
- Side effects of a transition commit with it: `PAID` credits loyalty points; `CANCELLED` gives back the promotion use and, via the event, releases stock; `PAID → CANCELLED` also reverses points and triggers a refund.
- **A payment that succeeds for an already-cancelled order** does not revive it: the order stays `CANCELLED`, and ordering publishes `ordering.payment.rejected`, on which payment refunds.

## Consequences

- Races resolve to one winner at the database; the loser gets a clear `409`.
- Consumers are idempotent for free: a redelivered `payment.succeeded` finds the order no longer `PENDING` and does nothing.
- The tracking page and the staff board read the history for their timelines.
- **Cost:** every status change is a small transaction with three writes (order, history, outbox).
- **Cost:** the late-payment refund path exists only for a rare race, but must be built and tested.

## See also

- [0010](./0010-enumerated-columns-are-strings-not-prisma-enums.md) — status is a string column validated in code.
- [0006](./0006-events-leave-through-a-transactional-outbox.md) — the status event.
- [0018](./0018-stock-is-reserved-at-order-creation-under-optimistic-locking.md) — what cancellation releases.
- [0021](./0021-promotions-and-loyalty-live-in-the-ordering-service.md) — what `PAID` credits.
