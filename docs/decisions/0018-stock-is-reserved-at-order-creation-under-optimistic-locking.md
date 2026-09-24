# 0018 — Stock is reserved at order creation under optimistic locking

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

Course Task 10 requires that customers ordering at the same time never oversell, using a transaction plus **optimistic locking**, proven by a test. Stock lives in catalog; orders live in ordering; no transaction spans them.

Most drinks are not counted at all — only limited items (a daily cold brew) are. Reserving at payment time would let two customers both place orders for the last unit and discover the problem after paying. Reserving at order creation holds stock for orders that may never be paid.

## Decision

- `products.stock_qty` is **nullable**: `NULL` = not counted, a number = units still sellable. `products.version` is the optimistic-lock counter.
- **Placing an order reserves stock** through one gRPC call to catalog, before the order is written. Inside one catalog transaction, for every counted line: read `stock_qty` and `version`, then `UPDATE products SET stock_qty = stock_qty - $q, version = version + 1 WHERE id = $id AND version = $v AND stock_qty >= $q`. Zero rows → re-read and retry, a bounded number of times; still short → the whole transaction rolls back and the call answers `OUT_OF_STOCK` naming the products. **All lines or none.**
- Each reservation is a `stock_reservations` row keyed **`(order_id, product_id)`**, status `HELD` → `CONFIRMED` (order paid) or `RELEASED` (order cancelled). Transitions are conditional on the current status, which makes the release idempotent: a redelivered cancel event finds nothing `HELD` and gives nothing back twice.
- A **sweep** handles `HELD` reservations older than 3 hours — typically ones whose order was never written (ordering failed after reserving). It asks ordering (`GetOrderStatus`) before acting: not found or `CANCELLED` → released; paid → confirmed; still unpaid → left alone. It never guesses.
- Stock crossing zero invalidates the menu cache, so the product shows sold out.

## Consequences

- Stock can never go negative (also a `CHECK`), and concurrent orders for the last unit resolve to exactly one winner — the graded concurrency test asserts it.
- **Cost:** under heavy contention on one product, requests retry and a few may be refused even though stock existed a moment later. At coffee-shop volume this is invisible.
- **Cost:** unpaid orders hold stock for up to 15 minutes (35 once a payment is started). A limited item can look sold out while someone decides.
- Rejected: pessimistic `SELECT … FOR UPDATE` — simpler and equally correct, but the rubric names optimistic locking. Rejected: reserving at payment — oversells between ordering and paying.

## See also

- [0019](./0019-order-status-changes-only-through-the-state-machine.md) — the status changes that confirm or release a reservation.
- [0006](./0006-events-leave-through-a-transactional-outbox.md) — the event carrying those changes to catalog.
- [0005](./0005-grpc-for-synchronous-calls-and-jetstream-for-events.md) — why reserving is a synchronous call.
