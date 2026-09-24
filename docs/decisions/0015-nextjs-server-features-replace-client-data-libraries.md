# 0015 — Next.js server features replace TanStack Query and Zustand; the cart is client state

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

The course brief suggests React Query (TanStack Query) and Zustand for the cart. Both solve problems of a client-rendered SPA: caching server data in the browser, and a global client store.

With the App Router, data is fetched in Server Components and mutated through Server Actions; the rendered result streams to the browser, and `router.refresh()` re-reads it. The one piece of genuinely client-side state in BrewLite is the cart, which a guest builds before signing in and which must survive a reload and a failed payment.

## Decision

- **Server Components** read through the generated client; **Server Actions** mutate; after a mutation the page revalidates or refreshes. **No TanStack Query.**
- **The web app caches no API data.** The only cache is catalog's menu cache in Redis, invalidated on every menu write — one layer, one place to invalidate.
- **The cart is a React Context** in the customer layout, persisted to `localStorage` (guarded; a blocked storage falls back to memory). **No Zustand.** It holds lines only; its total is a preview computed with `computeUnitPrice` from `contracts`. The checkout page shows the server's quote.
- The cart is cleared only when the confirmation page sees the order `PAID`.

## Consequences

- Less client JavaScript, one data-fetching model, no cache synchronization between browser and server.
- **Cost:** a departure from the course brief's suggested libraries; the brief's requirement — a cart with state, totals and a badge — is met by Context.
- **Cost:** no optimistic updates or background refetch out of the box; every mutation waits for the server round trip. For a menu and a checkout that is fine.
- **Cost:** the cart lives in one browser; it does not follow the customer to another device. A server-side cart is the upgrade if that is ever needed.
- Revisit if a screen becomes genuinely interactive enough to need client caching — the staff board is the likeliest candidate, and SSE plus refresh covers it today.

## See also

- [0014](./0014-the-web-server-is-the-gateways-only-client.md) — why all fetching happens on the Next.js server.
- [0023](./0023-redis-holds-only-reconstructible-state.md) — the one cache that does exist.
