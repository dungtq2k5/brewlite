# 0007 — One Postgres server holds one database per service, and nothing crosses between them

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

Database-per-service is what makes a service boundary real: if ordering can join `identity.users`, it will, and the boundary is gone. The reference project ran one Postgres **server** per service. This laptop already runs other projects' stacks with four Postgres containers of their own; four more for BrewLite, each with its own memory, is a real cost. A schema per service in one database is lighter still, but one connection string then reaches every schema.

## Decision

- **One PostgreSQL 18 container** (`brewlite-postgres`). Its init script creates, per service, three databases: `brewlite_<svc>` (working), `brewlite_<svc>_test` (integration tests only) and `brewlite_<svc>_shadow` (drift check only).
- Each service connects only to its own databases and owns its own Prisma schema and migrations ([0008](./0008-services-query-prisma-7-directly.md)).
- **No cross-service foreign key, join or transaction.** A reference to another service's row is a plain UUID column, validated when written, documented as `ref ➔ service.table.id` in the rdm-spec.
- `DATABASE_URL_TEST` differs from `DATABASE_URL` only in the database name.

## Consequences

- Isolation is at the database level: a service's Prisma client cannot even type another service's tables.
- A fresh clone plus `docker compose up` gives working and test databases for every service.
- **Cost:** services share one server's CPU, memory and connection limit; one slow query can affect all of them, and one stopped container stops everything locally. Acceptable for development and the course demo.
- **Cost:** referential integrity across services is the application's job. An order can reference a product id that was later archived; that is why orders snapshot names and prices.
- Moving a service to its own server later changes only its connection string.

## See also

- [0004](./0004-the-backend-is-a-gateway-plus-four-domain-services.md) — the services that own these databases.
- [0008](./0008-services-query-prisma-7-directly.md) — one Prisma schema per database.
- [0024](./0024-vitest-is-the-only-test-runner.md) — who uses the `_test` databases.
