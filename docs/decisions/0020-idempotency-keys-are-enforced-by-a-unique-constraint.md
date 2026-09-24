# 0020 — Idempotency keys are enforced by a unique constraint, not a cache

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

A double tap or a network retry on *Place order* or *Pay* must not create two orders or two charges. Course Task 10 requires an `Idempotency-Key` and a test that sending the same key twice creates one order.

The reference project stored `(route, caller, key) → response` in Redis at the gateway for 24 hours. That store fails open when Redis is down, expires, and is a second source of truth next to the database — the duplicate it misses is exactly the one that happens during an outage.

## Decision

- `POST /orders` and `POST /payments` **require** `Idempotency-Key`, a UUIDv7 the client creates once per user intent and reuses on every retry of it.
- The key is stored on the row it created: **`UNIQUE (user_id, idempotency_key)`** on `orders` and on `payments`, with a **`request_hash`** (SHA-256 of the canonical request body).
- On insert conflict the service reads the existing row: same `request_hash` → return it as the original result (`200` instead of `201`); different hash → `422 IDEMPOTENCY_KEY_REUSED`.
- A concurrent duplicate loses the unique-index race and takes the same path — no pre-check is trusted on its own.
- payment forwards the same key to Stripe's `checkout.sessions.create`, so Stripe also creates one session per intent.

## Consequences

- The guarantee survives retries, restarts, replicas and a Redis outage; the graded test holds concurrently, not only sequentially.
- **Cost:** two extra columns and an index on two tables; every other state-creating route that needs idempotency later needs the same columns.
- **Cost:** a replay returns the row's **current** state, not a byte-identical copy of the first response — an order paid since then replays as `PAID`. That is more useful, and clients must not assume otherwise.
- Keys never expire; a key is only meaningful per user, so reuse across users is impossible by construction.

## See also

- [0009](./0009-every-identifier-is-a-uuidv7.md) — the key is a client-generated UUIDv7.
- [0017](./0017-stripe-checkout-is-the-payment-surface.md) — the key forwarded to Stripe.
