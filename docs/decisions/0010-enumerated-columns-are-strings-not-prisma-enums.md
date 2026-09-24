# 0010 — Enumerated columns are strings, never Prisma enums

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

Order status, payment status, role, size, discount type — BrewLite has many closed value sets. They are needed in the database, in four services, in event payloads, in protos and in the web app. A Prisma `enum` becomes a Postgres enum type: adding a value is a migration, removing or renaming one is painful, and the TypeScript type is generated per service, so two services end up with two unrelated types for the same set.

## Decision

- **No `enum` block in any `schema.prisma`.** An enumerated column is `VARCHAR(n)` with a `///` comment naming its type.
- The value set is a TypeScript `enum` in **`packages/contracts`**, plus a derived `readonly` array for validation. Values are `SCREAMING_SNAKE_CASE`, stored verbatim.
- The code validates at every write — zod at the HTTP edge, the proto enum at the gRPC edge — and maps a stored string back **once**, with `parseEnum(OrderStatus, row.status)`, which throws on an unknown value.
- State machines also validate **transitions**, not only values ([0019](./0019-order-status-changes-only-through-the-state-machine.md)).
- Where a wrong value would be dangerous, a **`CHECK` constraint** in `schema-objects.sql` backs the code up (rdm-spec §5).
- The rdm-spec lists every value of every enumerated column; a value added in code and not there is drift.

## Consequences

- One definition of each set, shared by services and the browser.
- Adding a value is a code change, not a migration (unless a `CHECK` lists it).
- **Cost:** the database does not enforce most sets by itself; a raw SQL write can store garbage, which `parseEnum` then refuses loudly on read.
- **Cost:** three places to keep in step — the TypeScript enum, the rdm-spec list, and any `CHECK`. A guard spec comparing the first two is planned.

## See also

- [0008](./0008-services-query-prisma-7-directly.md) — the schema convention this belongs to.
- [0019](./0019-order-status-changes-only-through-the-state-machine.md) — the largest enumerated column and its transitions.
