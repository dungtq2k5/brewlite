# 0005 — gRPC carries synchronous calls; NATS JetStream carries every event

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

Services need two kinds of conversation. Some calls need an answer to continue — ordering cannot create an order without prices and a stock reservation; payment cannot open a checkout without knowing the order's total. Other messages are facts others react to — *this order was paid*, *this order was cancelled* — where the publisher should not wait on, or even know, its consumers.

Core NATS is at-most-once: a consumer that is restarting loses the message. REST between services would work but gives no typed contract shared by both ends.

## Decision

- **Synchronous calls use gRPC** — `@nestjs/microservices` with `@grpc/grpc-js`. `.proto` files live in `packages/contracts/proto/brewlite/<service>/`; `buf generate` runs **ts-proto** to generate TypeScript for both ends; `buf lint` runs in CI; generated code is committed and checked for drift. Every call goes through `BaseGrpcClient` in `nest-common` with a **2 s deadline**.
- Use gRPC only when **the caller needs the answer to continue**.
- **Every event goes through NATS JetStream**, never core NATS. Streams `ORDERING`, `PAYMENT` and `DLQ`; durable consumers; at-least-once delivery.
- The gateway's SSE fan-out is also a JetStream consumer — an ephemeral, ordered one per gateway process — because losing one of its frames costs latency, never data ([0022](./0022-order-updates-reach-browsers-as-server-sent-events.md)).

## Consequences

- A proto change breaks the build on both sides in the same PR; the contract cannot drift silently.
- A consumer that is down catches up when it returns; nothing is lost to a restart.
- **Cost:** two communication stacks, two code generators' worth of tooling (buf, ts-proto), and a broker to run.
- **Cost:** at-least-once delivery means every consumer must survive duplicates ([0006](./0006-events-leave-through-a-transactional-outbox.md)).
- **Cost:** every synchronous call is a runtime coupling — if catalog is down, no order can be placed. That is accepted for the two calls that need it, and is why the list of RPCs is short (api-endpoints-plan §9).

## See also

- [0004](./0004-the-backend-is-a-gateway-plus-four-domain-services.md) — the services being connected.
- [0006](./0006-events-leave-through-a-transactional-outbox.md) — how events are published safely.
