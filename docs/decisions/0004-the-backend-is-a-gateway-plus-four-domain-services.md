# 0004 — The backend is a NestJS gateway plus four domain services

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

The course requires NestJS behind a Next.js frontend. The product is small (product-overview §11.4) and would fit one NestJS process. The team's explicit goal, though, is to build and learn a real microservice system: synchronous gRPC, asynchronous NATS events, a database per service.

Given that goal, the question is where the boundaries go. Too many services and every feature crosses three of them; too few and the architecture is a monolith with extra steps.

## Decision

Five NestJS processes:

| Service | Owns | Database |
| :---- | :---- | :---- |
| `gateway` | the only public HTTP API: token verification, permission checks, validation, rate limits, OpenAPI, SSE, the Stripe webhook entry | none |
| `identity` | users, passwords, the Firebase sign-in exchange, sessions, roles | `brewlite_identity` |
| `catalog` | categories, products, sizes, toppings, images, availability, stock and reservations | `brewlite_catalog` |
| `ordering` | quotes, orders, the order state machine, promotions, loyalty | `brewlite_ordering` |
| `payment` | payments, Stripe Checkout, webhooks, refunds | `brewlite_payment` |

- Boundaries follow the data each rule needs in **one transaction**. Promotions and loyalty sit with orders because redeeming and earning must commit with the order ([0021](./0021-promotions-and-loyalty-live-in-the-ordering-service.md)). Stock sits with the menu because the menu shows sold-out state from it.
- `payment` is separate because it owns an external provider, its webhooks, its idempotency and its refunds — the part most likely to change and most dangerous to get wrong.
- The gateway holds no business rule and no database.

## Consequences

- Each service can be understood, tested and deployed alone; its schema cannot be queried by another.
- **Cost:** five processes, a broker, and a gateway for a coffee shop. More containers, more ports, more boot time.
- **Cost:** no transaction spans services. Placing an order reserves stock in catalog and writes the order in ordering; paying is confirmed in payment and applied in ordering. Every such flow needs an event, an idempotent consumer, and a plan for the window where the two disagree.
- Rejected: a modular monolith — the right answer for the product alone, but it does not meet the team's learning goal.

## See also

- [0005](./0005-grpc-for-synchronous-calls-and-jetstream-for-events.md) — how the services talk.
- [0006](./0006-events-leave-through-a-transactional-outbox.md) — how events survive crashes.
- [0007](./0007-one-postgres-server-with-a-database-per-service.md) — where their data lives.
- [0014](./0014-the-web-server-is-the-gateways-only-client.md) — who calls the gateway.
