# 0002 — Every amount is an integer number of Vietnamese đồng

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

BrewLite sells in one store, in Vietnam, in one currency. Money appears in prices, discounts, loyalty maths, order totals, payments and refunds, and crosses the database, gRPC, events, the web app and Stripe.

The reference project stored every amount as a `_minor` integer plus a `currency` column, because it expected more than one currency. VND has **no minor unit**, and Stripe treats it as a **zero-decimal** currency: `amount: 45000` means 45,000₫. The classic bug is multiplying by 100 out of habit and charging 100× the price.

## Decision

- Every amount is an **integer number of đồng**, in every layer — Postgres `INTEGER`, proto `int64`, JSON number, Stripe `amount`. Never a float, never `NUMERIC`, never a string.
- Money columns carry the unit in their name: **`_vnd`** (`base_price_vnd`, `total_vnd`). There is no `currency` column; the payment row alone records `currency = 'VND'` because it mirrors a Stripe object.
- The Stripe amount is the đồng total **as-is**. Never ×100, never ÷100.
- Prices include VAT. BrewLite computes no tax.
- Rounding happens once, in named functions: percent discounts round **down** to the đồng.

## Consequences

- No money type, no currency arithmetic helpers, no conversion — a sum is `+`.
- A reader sees the unit in every column and field name.
- **Cost:** a second currency later means renaming or adding columns on every money table and introducing a currency-aware type. Rejected alternative: the `_minor` + `currency` pair, which is YAGNI for one currency and invites the ×100 mistake for VND.
- **Cost:** tax invoices are out of scope; if they are ever needed, prices must be split into net and VAT.

## See also

- [0001](./0001-one-store-with-pickup-at-the-counter.md) — the single-store decision this narrows further.
- [0017](./0017-stripe-checkout-is-the-payment-surface.md) — where the zero-decimal rule meets Stripe.
