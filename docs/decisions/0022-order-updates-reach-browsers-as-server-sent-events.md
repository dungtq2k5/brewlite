# 0022 — Order updates reach browsers as Server-Sent Events fed from NATS

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

The customer's tracking page must follow *paid → preparing → ready* without reloading, and the staff board must show a new paid order within a second or two. Updates flow one way, server to browser.

The reference project used socket.io with a Redis adapter — bidirectional, with rooms and a handshake protocol. BrewLite needs none of the bidirectional part. Polling every few seconds is the simplest option, but it is slow for the board or wasteful at short intervals.

## Decision

- The gateway serves two **SSE** endpoints: `GET /orders/:id/events` (the order's owner) and `GET /staff/orders/events` (staff).
- Each gateway process runs an **ephemeral, ordered JetStream consumer** on `ordering.order.status_changed`, new messages only, and writes matching events to the open streams. A heartbeat comment every 25 s keeps proxies from closing idle connections.
- The browser connects to a **Next.js Route Handler** (`/api/events/…`), which adds the bearer token from the cookie and pipes the gateway's stream through.
- **An event is a nudge, not the record**: `{ orderId, orderNo, status, at }`. The page applies it and, on every (re)connect, calls `router.refresh()` to re-read the truth. A dropped connection costs latency, never state.
- Polling with `router.refresh()` is the fallback if a proxy between browser and server breaks streaming.

## Consequences

- Native `EventSource`, automatic reconnect, no client library, no Redis adapter — each gateway process sees every event through its own consumer.
- **Cost:** long-lived connections are held by both the Next.js server and the gateway; each open tab is one connection through two processes.
- **Cost:** a Route Handler that streams must be dynamic and uncached, and some hosting platforms cap response duration; reconnect handles the cap.
- **Cost:** events missed while disconnected are not replayed; the refresh on reconnect is what makes that safe.

## See also

- [0005](./0005-grpc-for-synchronous-calls-and-jetstream-for-events.md) — the one non-durable JetStream consumer.
- [0014](./0014-the-web-server-is-the-gateways-only-client.md) — why the stream is proxied.
