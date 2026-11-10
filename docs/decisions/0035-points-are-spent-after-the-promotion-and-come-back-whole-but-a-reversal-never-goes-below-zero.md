# 0035 — Points are spent after the promotion, come back whole, and a reversal never goes below zero

**Status:** Accepted · **Date:** 2026-11-10 · **Supersedes:** — · **Superseded by:** —

## Context

Spending loyalty points at checkout (product-overview §6.6, P1) meets three rules already in force: one promotion code per order, a total that never drops below `MIN_PAYABLE_VND`, and a balance that never goes negative. The specs said points are worth `LOYALTY_POINT_VALUE_VND` each and pay at most `LOYALTY_MAX_REDEEM_PERCENT` of the subtotal, but not how they combine with a code, what an order paid partly with points earns, how such an order is refunded, or what reversing an order's earned points does once the customer has spent them (rdm-spec O-5 left it open).

The alternatives that were real:

- **Order of discounts:** the 50 % cap on the subtotal, or on what is left after the code (a smaller points discount whenever a code is used); or a code *or* points, never both (simplest, but customers lose value they hold).
- **Earning:** on the amount paid, or on the subtotal as if no points were spent (more generous, a second formula).
- **Reversal when the points are gone:** forgive the shortfall, carry it as a debt against future earnings (fairer to the shop, a new concept in the ledger and on the account page), or refuse the cancel (the counter would lose its only refund path).
- **Refund:** the card back and the points back, or cash for the points' value too (paying out money the shop never received).

## Decision

- **The promotion applies first**, to the subtotal. **Points apply second**, in whole points, capped by the smallest of: the customer's balance, `LOYALTY_MAX_REDEEM_PERCENT` of the **subtotal**, and what keeps the total at or above `MIN_PAYABLE_VND`. A request for more is refused `POINTS_INSUFFICIENT` (more than the balance) or clipped to the cap by the quote — never silently over-applied.
- **Points are taken when the order is placed** (an O-6 `REDEEM` row in the placing transaction) and **returned whole** (`REDEEM_RETURNED`) whenever the order is cancelled — by the customer, by expiry or by staff.
- **Earning uses the amount paid**: `floor(total / LOYALTY_EARN_STEP_VND)`, where the total is after both discounts — the formula already in force.
- **A refund returns what was charged**: the full `total_vnd` to the card or wallet, and the redeemed points through `REDEEM_RETURNED`. Points are never paid out as money.
- **A reversal never goes below zero**: `EARN_REVERSED` removes `min(points earned, balance at that moment)`; the shortfall is forgiven, and the ledger row records the points actually removed.

## Consequences

- One rule set for the quote, the order and the refund; the customer always gets back exactly what they gave.
- The `MIN_PAYABLE_VND` floor and Stripe's minimum charge stay safe: points can never push a payment under them.
- **Cost:** a customer can earn on an order, spend the points, then have the order cancelled and keep the value — the shop absorbs it. With 1 point per ₫10,000 paid and staff cancels rare, the exposure is small; a debt model would need a new ADR.
- **Cost:** `EARN_REVERSED` is no longer always the negative of its `EARN`, so a report summing the ledger must read the rows, not assume symmetry.

## See also

- [0021](./0021-promotions-and-loyalty-live-in-the-ordering-service.md) — why points live in ordering, beside the order transaction that spends and returns them.
- [0020](./0020-idempotency-keys-are-enforced-by-a-unique-constraint.md) — the placing request that takes the points is idempotent, so a retried tap never spends them twice.
