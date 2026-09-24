# 0006 — Events leave a service through a transactional outbox, and consumers are idempotent by construction

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

When payment marks a payment `SUCCEEDED` it must tell ordering, or the order never becomes `PAID`. If it commits and then publishes, a crash between the two loses the event forever — silently. If it publishes first, a failed commit announces something that never happened. JetStream's durability starts only once the message reaches it; it cannot close that window.

JetStream is at-least-once, and a relay may republish after a crash, so every consumer will sometimes see an event twice.

## Decision

- A service that publishes owns an **`outbox_events`** table (rdm-spec §2.7). The event row is written **in the same transaction** as the state change it describes. Today: `ordering` and `payment`.
- A **relay** in that service polls unpublished rows (`FOR UPDATE SKIP LOCKED`, in id order), publishes each with **`Nats-Msg-Id` = the outbox row id**, and stamps `published_at`. Nothing else in a service publishes to JetStream.
- **Consumers are idempotent by construction**: the effect is a conditional update (`UPDATE … WHERE status = 'PENDING'`) or an insert guarded by a unique key (`UNIQUE (order_id, kind)`), so a redelivery changes nothing. No `processed_events` table exists; a future consumer that cannot be made idempotent this way adds one.
- A consumer's handler has three outcomes: transient failure → throw (redelivered with backoff); obsolete or already applied → return (acked); can never succeed → poison (copied to `dlq.<service>.<consumer>`, terminated). Max 10 deliveries.
- The outbox row also carries the request id, copied into the NATS headers by the relay, so logs follow a request across the async hop.

## Consequences

- A crash delays an event; it never loses one.
- A relay crash after publishing and before marking produces a duplicate that JetStream deduplicates within its 2-minute window, and consumers absorb outside it. That duplicate is by design and must not be "fixed".
- **Cost:** an extra table and a relay loop per publishing service, a prune job, and a few hundred milliseconds of latency between commit and publish.
- **Cost:** every consumer must be written to be idempotent, and reviewed for it; every consumer has a test that delivers the same event twice.

## See also

- [0005](./0005-grpc-for-synchronous-calls-and-jetstream-for-events.md) — the broker this publishes to.
- [0019](./0019-order-status-changes-only-through-the-state-machine.md) — conditional updates are what make ordering's consumers idempotent.
- [0018](./0018-stock-is-reserved-at-order-creation-under-optimistic-locking.md) — reservation status makes catalog's consumer idempotent.
