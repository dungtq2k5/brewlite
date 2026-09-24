# 0008 — Services query Prisma 7 directly; there is no repository layer

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

The course suggests Prisma or TypeORM. Prisma gives a typed client generated from a schema file, migrations, and one schema per service. Prisma 7 differs from most tutorials: driver adapters are required, the `prisma-client` generator needs an explicit output, the connection URL moves to `prisma.config.ts`, and `.env` is no longer loaded for you.

A repository layer over Prisma would wrap an already-typed client in a second API that every query must be added to, with little to gain — the service would still own the transaction.

## Decision

- **Prisma 7** in every domain service: `@prisma/adapter-pg`, generator `prisma-client` with `output = "../generated/prisma"` (outside `src/`, git-ignored) and `moduleFormat = "cjs"`, URL in `prisma.config.ts` (which imports `dotenv/config`). The template is in architecture-and-tech-stack §3.2.
- **One `schema.prisma` per service**, with its own migrations and generated client.
- **No repository layer.** A `<module>.service.ts` injects `PrismaService`, opens transactions and runs queries. It is the only file of its module that queries.
- **Pure rules live in `domain/`** as plain functions with no Nest and no Prisma import — the state machine, pricing, promotion and loyalty maths — unit-tested without a framework.
- **Mappers** convert rows to proto messages field by field; controllers and consumers never import the Prisma client.
- What Prisma cannot express (partial unique indexes, `CHECK`s, sequences) lives in `prisma/sql/schema-objects.sql`, applied after `migrate deploy`.

## Consequences

- One place per module to read every query and every transaction.
- **Cost:** services are unit-tested with `PrismaService` mocked, which proves orchestration but not SQL; every constraint, conditional update and concurrency rule needs an integration test against the `_test` database.
- **Cost:** Prisma 7 is new enough that tutorials mislead; the verified template in the architecture doc is the reference, and `generate` and seeding are explicit steps in every script.
- **Cost:** `prisma migrate reset` and `db push` leave out `schema-objects.sql`; every script follows them with `pnpm db:objects`.

## See also

- [0007](./0007-one-postgres-server-with-a-database-per-service.md) — the databases these schemas map to.
- [0010](./0010-enumerated-columns-are-strings-not-prisma-enums.md) — a schema rule that follows from owning values in `contracts`.
- [0012](./0012-swc-compiles-everything-and-nest-packages-are-commonjs.md) — why `moduleFormat = "cjs"` and why SWC must compile `generated/`.
