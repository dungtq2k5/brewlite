# 0011 — zod is the only schema language, and the web client is generated from it by Orval

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

The web app, the gateway and the event payloads all need schemas. The course brief suggests `class-validator` on the backend; the frontend would then need its own types, written by hand, and they would drift from the API the first time a field is renamed. Swagger documentation written by decorator, separately from validation, drifts the same way.

## Decision

```text
zod schema ─nestjs-zod─▶ DTO + runtime validation
           ─@nestjs/swagger + cleanupOpenApiDoc─▶ services/gateway/openapi.json (committed)
           ─Orval─▶ packages/api-client: typed fetch functions + zod schemas ─▶ apps/web
```

- Every request and response shape is a **zod schema**, turned into a Nest DTO by **nestjs-zod** — the schema that validates is the schema that is documented.
- Requests are `.strict()`: an unknown field is `400`, not silently dropped. Responses are `.nullable()`, never `.optional()`, so the key set is stable.
- `pnpm --filter @brewlite/gateway openapi:emit` writes `openapi.json` without starting a server. **Orval** generates a `fetch` client (no TanStack Query hooks) and zod schemas the web app reuses for forms.
- Both generated artefacts are **committed**; CI regenerates them and fails on any diff.
- Event payloads are zod schemas in `packages/contracts`, validated before an outbox insert and on consume.

## Consequences

- A backend change that breaks the web app fails the web app's type check in the same PR.
- One schema language across HTTP, events, forms and environment variables.
- **Cost:** a departure from the course brief's `class-validator`. The brief's requirement is *validated input*; zod meets it, and the choice is stated here so it is not mistaken for an omission.
- **Cost:** nestjs-zod and Orval are two more tools whose versions must move together with zod's; a major zod upgrade is a coordinated change.
- **Cost:** the generated client is only as good as the declared responses — an undeclared response or error code is an untyped client.

## See also

- [0014](./0014-the-web-server-is-the-gateways-only-client.md) — where the generated client runs.
- [0015](./0015-nextjs-server-features-replace-client-data-libraries.md) — why no TanStack Query hooks are generated.
