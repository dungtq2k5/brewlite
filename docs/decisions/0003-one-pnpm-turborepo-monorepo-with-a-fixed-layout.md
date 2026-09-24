# 0003 — The repository is one pnpm + Turborepo monorepo with a fixed layout

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

BrewLite has one web app, one gateway, four domain services, and values they must agree on: enums, error codes, permissions, event payloads, protos, the pricing function. The course asks for a monorepo (or two folders) with a README and `.env.example`.

Separate repositories would mean publishing shared packages and keeping versions in step by hand. One repository with no structure lets every app import every other app's files. Moving files after the first feature lands breaks every open branch, so the layout is agreed before the first commit.

## Decision

One repository, **pnpm 10 workspaces** orchestrated by **Turborepo 2**, with this layout:

```text
apps/web                Next.js — customer, staff and admin pages
services/gateway        NestJS — public HTTP API, no database
services/identity       NestJS
services/catalog        NestJS
services/ordering       NestJS
services/payment        NestJS
packages/contracts      client-safe shared values, pricing, events, protos
packages/nest-common    server-only Nest building blocks
packages/api-client     Orval-generated client
packages/config         tsconfig / eslint / nest-cli / vitest presets, lint rules, guard specs
infra/docker            compose, Dockerfiles, init scripts, Firebase emulator config
docs/
```

- Import across a package boundary **by package name** (`@brewlite/contracts`), never by relative path.
- Services never import each other; they share only `contracts` and `nest-common`.
- **A new shared package requires a second consumer** that exists or is imminent.
- `packages/contracts` is imported by the browser app, so it imports no `node:*` module.

## Consequences

- One `pnpm install`, one lockfile, one CI pipeline; Turborepo caches builds and runs only affected tasks.
- A change to a proto or an enum is one PR across both ends.
- **Cost:** everyone builds a tree they mostly do not touch; the cache is what keeps it fast.
- **Cost:** pnpm's strict `node_modules` rejects phantom dependencies, and pnpm 10 blocks dependency build scripts unless allowed — both surface as install errors early rather than runtime errors later.
- No shared React package and no framework-free core package: nothing has a second consumer for them.

## See also

- [0004](./0004-the-backend-is-a-gateway-plus-four-domain-services.md) — the services this layout holds.
- [0012](./0012-swc-compiles-everything-and-nest-packages-are-commonjs.md) — how the packages are compiled.
