# 0017 — Stripe Checkout is the payment surface, fulfilled only from webhooks

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

The course asks for cashless payment by wallet or card through a mock gateway (it names Momo, VNPay and Stripe as examples). The team chose **Stripe**. Stripe offers several surfaces: hosted Checkout (a redirect away from the app), embedded Checkout (Stripe's form inside our page), the Payment Element over Checkout Sessions or raw PaymentIntents (most control, most code).

A customer can pay and close the tab before the return page loads, so the return page cannot be what marks an order paid. Tests and a demo without network access must not depend on Stripe at all.

## Decision

- **Checkout Sessions**, `mode: 'payment'`, **embedded** in the checkout page. One line item — *BrewLite order #1042* — with the order total in **VND** via `price_data`, so discounts never disagree with Stripe's arithmetic. `client_reference_id` and `metadata` carry the payment and order ids; the session expires after 30 minutes.
- **Never pass `payment_method_types`.** Card, Google Pay, Apple Pay and Link are configured in the Dashboard; Stripe shows what fits the device.
- A **restricted key** (`rk_test_…`), test mode only. `new Stripe(key, { apiVersion })` with the version pinned.
- The `Idempotency-Key` of `POST /payments` is forwarded to `checkout.sessions.create`.
- **Fulfilment only from the webhook**: `checkout.session.completed` when `payment_status` is not `unpaid`, `checkout.session.async_payment_succeeded` → succeeded; `checkout.session.async_payment_failed` → failed; `checkout.session.expired` → expired (reported as failed). The gateway forwards the **raw body** and signature to payment, which verifies before anything else and records the Stripe event id under a unique key, so a redelivery is acknowledged and ignored.
- **Refunds** are issued automatically for a paid order cancelled by staff and for a payment that succeeds after its order was cancelled.
- A **fake provider** implements the same `PaymentProvider` interface (`PAYMENT_PROVIDER=fake`): *simulate success / failure* produce exactly the events a webhook would. Refused in production.

## Consequences

- Stripe hosts the card form: no card data touches BrewLite, and wallets work without extra code.
- The customer never leaves the app, matching the wireframe's payment screen.
- **Cost:** Stripe does not onboard Vietnamese merchants; this is **test mode only**, stated in the README. VND is zero-decimal and has a minimum charge, hence `MIN_PAYABLE_VND`.
- **Cost:** locally, webhooks need `stripe listen --forward-to`; without it payments never complete (the fake provider covers most development).
- **Cost:** the return page must wait for the webhook-driven status instead of trusting the redirect — a short "confirming payment" state in the UI.
- Rejected: raw PaymentIntents with the Payment Element (more code for the same result), hosted redirect (leaves the app), Momo/VNPay (the team chose Stripe).

## See also

- [0002](./0002-every-amount-is-an-integer-number-of-dong.md) — VND is zero-decimal: never ×100.
- [0020](./0020-idempotency-keys-are-enforced-by-a-unique-constraint.md) — idempotent payment requests.
- [0006](./0006-events-leave-through-a-transactional-outbox.md) — how a verified webhook becomes an event for ordering.
