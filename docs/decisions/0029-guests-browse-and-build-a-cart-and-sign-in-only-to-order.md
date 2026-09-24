# 0029 — Guests browse and build a cart; signing in is required only to order

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

The Product Vision is *order in a few taps*. A sign-up wall before the menu costs customers who only wanted to see prices; the course's own flow puts *sign in (if not yet)* after the cart and before payment.

But an order must belong to someone. It has to be found again in history, tracked live, credited with loyalty points, and scoped for idempotency, and the course's Task 7 asks for a guard on the order routes. Guest checkout would need a second identity (an order token in a cookie or an emailed link), a merge when that guest later registers, and its own abuse controls — a lot of product for a shop whose customers can sign in with one Google tap.

Where the guest's cart lives decides whether sign-in can lose it.

## Decision

- **Guests may:** read the menu, categories and product details; build and edit a cart; see its preview total; switch language; register or sign in.
- **Guests may not:** open checkout, apply a promo code, place an order, pay, or see orders or points. Every route for those is `USER`; only menu reads and sign-in are `PUBLIC`.
- **The cart lives in the browser** (React Context + `localStorage`), so building one needs no account and no server call, and signing in cannot lose it. **Sign-in keeps the cart; sign-out clears it**, so a shared device does not hand the next person someone else's cart.
- **Sign-in is asked for at the *Checkout* button.** The web server's `proxy.ts` sends a guest requesting `/checkout`, `/orders*` or `/account` to `/login?next=<path>` and back after sign-in. `next` is honoured only as a relative path, so it cannot be an open redirect.
- **No guest checkout.**

## Consequences

- A first-time visitor sees the whole menu and builds an order before any form appears; the only interruption is one sign-in, at the moment it is needed.
- The server never stores anonymous state — no guest sessions, no guest carts, nothing to expire or merge.
- **Cost:** a customer who will not create an account cannot order at all. Google (and, when available, Apple) sign-in keeps that to one tap; guest checkout is out of scope.
- **Cost:** a cart does not follow a customer to another device, and a guest's promo code is only validated after sign-in (the quote route is `USER`, because the per-customer limit needs a customer).
- **Cost:** the cart's prices can be stale by the time of checkout; the server's quote is shown there and wins.

## See also

- [0014](./0014-the-web-server-is-the-gateways-only-client.md) — the proxy and cookies that implement the sign-in round trip.
- [0015](./0015-nextjs-server-features-replace-client-data-libraries.md) — why the cart is client state.
- [0013](./0013-identity-issues-brewlite-tokens-and-firebase-only-proves-sign-ins.md) — the one-tap sign-ins that keep this cheap.
- [0020](./0020-idempotency-keys-are-enforced-by-a-unique-constraint.md) — idempotency keys are scoped per user, one reason an order needs an account.
