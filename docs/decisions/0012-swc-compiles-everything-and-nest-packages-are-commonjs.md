# 0012 — SWC compiles every package; Nest services and shared packages are CommonJS

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

The team wants SWC for both frontend and backend. `tsc` builds of several Nest services are slow; Next.js already compiles with its own SWC-based toolchain. SWC strips types without checking them, so it cannot be the only thing standing between a type error and a build.

Nest's decorator-based dependency injection needs `emitDecoratorMetadata`, and several libraries it relies on still assume CommonJS; Prisma 7 can generate either.

## Decision

- **Every Nest service, the gateway included,** builds with the Nest CLI's **SWC builder and `typeCheck: true`**. `typeCheck` is never turned off to speed a build up. The builder's `filenames` include `generated/`, where Prisma writes its client.
- The web app builds with **Next.js's own compiler** (SWC-based).
- **Vitest** transforms with **`unplugin-swc`**, decorator metadata on — otherwise Nest DI resolves `undefined` in tests.
- `pnpm typecheck` runs `tsc --noEmit` everywhere in CI, first, before tests.
- **Nest services and the shared packages they import are CommonJS.** `tsconfig` sets `isolatedModules`, `experimentalDecorators`, `emitDecoratorMetadata`, and not `verbatimModuleSyntax`. The web app is ESM and imports the CommonJS packages.
- **Type-only imports use `import type`** (enforced by `@typescript-eslint/consistent-type-imports`) — **except a class injected through a constructor**, whose metadata would become `Object` and whose injection would resolve `undefined`. The lint rule is configured with `emitDecoratorMetadata` so its autofix leaves those alone.

## Consequences

- Fast builds everywhere, one compiler family.
- **Cost:** a type error passes the SWC build and every test; only `typecheck` catches it. CI order matters.
- **Cost:** the `import type` DI trap produces a boot-time "cannot resolve dependency" that looks unrelated to imports; a unit test that boots a module with an injected class guards it.
- **Cost:** CommonJS rules out ESM-only packages in services (some newer libraries). Each is a deliberate choice, not a quick `pnpm add`.

## See also

- [0003](./0003-one-pnpm-turborepo-monorepo-with-a-fixed-layout.md) — the packages being compiled.
- [0008](./0008-services-query-prisma-7-directly.md) — Prisma's `moduleFormat = "cjs"` and `generated/` output.
- [0024](./0024-vitest-is-the-only-test-runner.md) — the test transform.
