# 0021 — Promotions and loyalty points live in the ordering service

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

Course Task 10 requires applying valid discount codes and crediting loyalty points after an order is `PAID`. The course's minimal entity list puts `loyaltyPoints` on `User`, which would place it in identity.

A promotion's usage cap and a customer's points must change **atomically with the order** that uses or earns them: a code counted for an order that then fails, or points credited twice for one payment, are exactly the bugs a cross-service call plus an event would invite.

## Decision

- **Promotions** live in ordering (`promotions`). Placing an order with a code **locks the promotion row** (`SELECT … FOR UPDATE`) inside the order transaction, checks window, minimum, total cap and per-customer limit, increments `used_count`, and writes the order. Cancelling gives the use back (`used_count - 1`) in the cancel transaction. The per-customer limit counts that customer's non-cancelled orders with that promotion.
- **Loyalty** lives in ordering: `loyalty_accounts` (balance per user) and `loyalty_transactions` with **`UNIQUE (order_id, kind)`**. Points are **earned in the same transaction as the `PAID` transition**; reversed in the same transaction as `PAID → CANCELLED`. The unique key makes each credit exactly-once, even under redelivery.
- *(P1)* Redeeming points at checkout is part of the same order transaction.
- `GET /loyalty/me` is served by ordering.

## Consequences

- Every money-like rule of an order commits or rolls back with the order. No event, no compensation, no cross-service call.
- **Cost:** the promotion row lock serialises concurrent orders using the **same** code. At one shop's volume that is milliseconds.
- **Cost:** a departure from the course entity list — `users.loyalty_points` does not exist; the balance is `loyalty_accounts.balance` in ordering, and `/users/me` does not include it. The web app reads both.
- **Cost:** ordering is the largest service; promotions and loyalty could be split out later only by accepting cross-service consistency work.

## See also

- [0004](./0004-the-backend-is-a-gateway-plus-four-domain-services.md) — the boundaries this sharpens.
- [0019](./0019-order-status-changes-only-through-the-state-machine.md) — the transitions that earn and reverse points.
