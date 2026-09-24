# 0024 — Vitest runs every non-browser test; integration tests use paired test databases

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

The Definition of Done requires tests, and course Task 10 is graded by three: illegal transitions refused, the same idempotency key creating one order, and concurrent orders never overselling. The last two are properties of the database under concurrency; a mocked Prisma client cannot prove them.

Nest's DI needs decorator metadata at test time, which Vitest's default transform does not emit. Integration tests that share the development database or broker corrupt developer data and flake.

## Decision

- **Vitest** runs every unit, integration, contract and gateway e2e test, transforming with **`unplugin-swc`** (decorator metadata on). Projects are declared in the root Vitest config. **Playwright Test** runs only the browser end-to-end suite *(P1)*.
- **Unit:** pure rules without I/O; services with `PrismaService` mocked.
- **Integration:** each service against its **`brewlite_<svc>_test`** database and the separate **NATS test broker**. Migrate once in global setup, truncate between specs. A setup reads its service's `.env` into a local object and never writes `process.env`.
- **The Task 10 proofs are integration tests**, named for what they prove: `refuses an ILLEGAL transition`, `creates ONE order for two requests with the same Idempotency-Key`, `never oversells under CONCURRENT orders`.
- Every consumer has a test delivering the same event twice. Every `CHECK` and partial unique index has a test proving it refuses.
- Stripe is never called in CI; webhook tests use events signed with the SDK against a local secret, so the real verification code runs.

## Consequences

- One runner, one config language, one watch mode for the backend.
- The graded properties are proven against real Postgres, concurrently.
- **Cost:** integration tests need Postgres, Redis and NATS running — Compose locally, service containers in CI.
- **Cost:** suites touching one database run serially; the integration tier is the slow one.

## See also

- [0007](./0007-one-postgres-server-with-a-database-per-service.md) — where the `_test` databases come from.
- [0012](./0012-swc-compiles-everything-and-nest-packages-are-commonjs.md) — the SWC transform.
- [0018](./0018-stock-is-reserved-at-order-creation-under-optimistic-locking.md), [0019](./0019-order-status-changes-only-through-the-state-machine.md), [0020](./0020-idempotency-keys-are-enforced-by-a-unique-constraint.md) — the rules the three proofs cover.
