# 0001 — BrewLite serves one store, with pickup at the counter only

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

The Product Vision is one sentence: customers order and pay for drinks cashless in a few taps, cutting the queue and getting the order ready fast at the counter. Everything else a coffee app could do — delivery, table service, several branches, a chain-wide loyalty scheme — pulls in addresses, couriers, table maps, per-store menus and per-store stock.

Each of those multiplies the data model: a `store_id` on products, stock, orders, promotions, staff and reports, and a store picker in front of the menu. None of it makes the counter faster.

## Decision

BrewLite serves **one store**. An order is always **collected at the counter**; there is no delivery, no table service, no QR-at-table, no second branch.

The vision is the scope filter: a feature that does not make ordering-and-paying faster, or the counter faster, is out (product-overview §11.4).

## Consequences

- No table carries a `store_id`. Stock, menu, promotions and the staff board are global.
- The confirmation screen always says *please collect at the counter*; no address or table number is ever collected.
- **Cost:** a second store later is a migration touching almost every table (`store_id` plus backfill), store-scoped staff permissions, and a store picker in the UI. That is accepted — it is a different product.
- **Cost:** a customer cannot order ahead for delivery; the product loses that audience on purpose.

## See also

- [0002](./0002-every-amount-is-an-integer-number-of-dong.md) — one store, one currency; the same narrowing applied to money.
- [0016](./0016-three-fixed-roles-and-a-compile-time-permission-catalogue.md) — three fixed roles are enough because there is one store to staff.
