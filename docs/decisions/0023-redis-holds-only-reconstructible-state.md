# 0023 — Redis holds only reconstructible state: rate limits, cache and job queues

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

The team wants Redis for caching, job queues and rate limiting. Each is useful; none should become a place where data lives that Postgres does not also have. A Redis that is flushed, restarted or evicts keys must leave the system correct.

## Decision

One Redis 8 container, three roles:

| Role | Where | Keys |
| :---- | :---- | :---- |
| Rate limits | gateway, `@nestjs/throttler` with Redis storage, so limits hold across replicas | `gw:rl:*` |
| Cache | catalog's public menu, deleted after every menu write commits and when a product's stock crosses zero; `MENU_CACHE_TTL_MS` is only the backstop | `catalog:*` |
| Job queues | BullMQ via `@nestjs/bullmq`: repeatable jobs with stable ids — `orders-expire`, `reservations-release-orphans`, `outbox-prune` | `bull:*` |

- `maxmemory-policy noeviction` (BullMQ requires it).
- **Every value is reconstructible.** Rate-limit counters may reset; the menu is re-read from Postgres; repeatable jobs are re-registered at boot and each run re-derives its work from Postgres (expired orders, old reservations), so a lost job run is repeated by the next one.
- Scheduled work is a BullMQ repeatable job, never `@Cron`, which fires once per replica.
- Idempotency is **not** kept in Redis ([0020](./0020-idempotency-keys-are-enforced-by-a-unique-constraint.md)).

## Consequences

- `FLUSHALL` is safe: the worst effect is a cold cache and a reset rate limit.
- **Cost:** a Redis outage stops rate limiting and scheduled jobs until it returns; the gateway's throttler fails open (logged), and overdue orders are cancelled on the first run after recovery.
- **Cost:** cache invalidation is explicit — a menu write path that forgets to delete the key shows stale data until the TTL.

## See also

- [0015](./0015-nextjs-server-features-replace-client-data-libraries.md) — the web app caches nothing, so this is the only cache.
- [0020](./0020-idempotency-keys-are-enforced-by-a-unique-constraint.md) — why idempotency is not here.
