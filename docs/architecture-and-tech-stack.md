# BrewLite — Architecture & Technology Stack

**Audience:** the developers on this team.

**Purpose:** answer one question — *what do I need to know before I write code?*

**Companion docs:** [`product-overview.md`](./product-overview.md) answers *what are we building?* — read it first; this document assumes it. [`decisions/`](./decisions/) records *why* each choice below was made.

BrewLite is one **TypeScript monorepo**: a Next.js web app, a NestJS gateway, four NestJS domain services, and shared packages — one language and one type system from the Prisma query to the button. The product is deliberately small (product-overview §11.4); the architecture is a real microservice system because the course and the team want to learn one, and every piece of it is proven by a walking skeleton before a feature depends on it.

---

## 0. Reading the annotations

- **🎓 Learn this first** — a blocking prerequisite.
- **⚠️ Gotcha** — a known trap.
- **🔬 Verify at scaffold** — believed true, not yet checked on this machine; the first implementation doc confirms it and edits this line.
- **📌 Decision** — settled; the reasoning and the cost are in the linked ADR. Read it before proposing a change.

---

## 1. Core ecosystem and workspace

- **Language:** **TypeScript**, `strict: true` everywhere, no `any` in merged code.
- **Runtime:** **Node.js 24 LTS**, pinned at **24.14.0** in `.nvmrc`, `engines`, every Dockerfile and every CI job.
- **Package manager:** **pnpm 10** with workspaces, version pinned by `packageManager` in the root `package.json` and enabled through `corepack`.
  - ⚠️ pnpm 10 skips dependency build scripts unless allowed. Set `strictDepBuilds: true` and list what may build (`@swc/core`, `prisma`, `@prisma/engines`, `esbuild`, `protobufjs`, `@bufbuild/buf`, `simple-git-hooks`, `@scarf/scarf`, `@firebase/util`) so a skipped native build fails the install instead of failing at runtime. Both settings live in **`pnpm-workspace.yaml`**. ⚠️ `ignoredBuiltDependencies` only silences the prompt — under `strictDepBuilds` an unlisted package still fails the install, so a package is either allowed or the install fails.
- **Monorepo tooling:** **Turborepo 2** — task graph and output caching (`build`, `typecheck`, `test`, `db:generate`). 📌 [ADR 0003](./decisions/0003-one-pnpm-turborepo-monorepo-with-a-fixed-layout.md).
  - ⚠️ Turbo's strict env mode hides variables from tasks: `turbo.json` lists `DATABASE_URL*`, `PRISMA_DB` and `NODE_ENV` in `globalPassThroughEnv`, or Prisma tasks see them unset.
- **Compiler:** **SWC everywhere** — the Nest CLI's SWC builder with `typeCheck: true` for every Nest service, Next.js's own SWC-based compiler for the web app, `unplugin-swc` inside Vitest. 📌 [ADR 0012](./decisions/0012-swc-compiles-everything-and-nest-packages-are-commonjs.md).
  - ⚠️ SWC strips types without checking them. `typeCheck: true` and a separate `pnpm typecheck` in CI are what stop a broken signature from shipping.
- **Module format:** Nest services and the shared packages they import are **CommonJS**; the web app is ESM, which imports CommonJS packages without trouble.
- **Containers:** **Docker + Compose v2** — one `docker compose up` gives Postgres, Redis, NATS and the Firebase emulators.
- **Quality:** **ESLint 9** flat config + **Prettier**, one shared config in `packages/config`; **lint-staged** on a pre-commit hook and **commitlint** on commit-msg, both run by **`simple-git-hooks`** (one block in the root `package.json`); **markdownlint-cli2 ≥ 0.23** for docs (0.15 mis-loads an `.mjs` custom rule under Node 24's `require(esm)`), with one custom rule — `brewlite-table-delimiter`, in `packages/config/markdownlint/table-delimiter.mjs` with its Vitest spec — that makes every table delimiter cell `:----` and fixes offending rows under `--fix`; **Conventional Commits** enforced by commitlint.
- **Verified at scaffold (2026-09-25):** TypeScript 5.9.3, NestJS 11.2, Prisma 7.10, zod 4.6, nestjs-zod 5.5, `@nestjs/swagger` 11.4, Express 5.2, Vitest 4.1, Turborepo 2.11, `@grpc/grpc-js` 1.14, buf 1.73, pnpm 10.34.5. The rest are verified by the doc that first installs them.
- **Pinned majors:** NestJS **11**, Prisma **7**, TypeScript **5.9**, Next.js **16**, React **19**, i18next **25** + react-i18next **16**, Tailwind CSS **4**, DaisyUI **5**, zod **4**, nestjs-zod **5**, Orval **7+**, Vitest **4**, BullMQ **5**, `stripe` (Node) **22**, `firebase-admin` **13**, `firebase` (web) **12**, PostgreSQL **18**, Redis **8**, NATS **2.x** with JetStream. A new major is an upgrade decision, never a side effect of `pnpm add`.

### 1.1 Repository layout

📌 [ADR 0003](./decisions/0003-one-pnpm-turborepo-monorepo-with-a-fixed-layout.md).

```text
brewlite/
├─ apps/
│  └─ web/                 # Next.js — customer, staff and admin pages in one app (RBAC by route);
│                          #   src/i18n/locales/{en,vi}/*.json holds the UI strings
├─ services/
│  ├─ gateway/             # NestJS — the only public HTTP API; no database
│  ├─ identity/            # NestJS — users, passwords, Firebase exchange, sessions, roles
│  │  └─ prisma/schema.prisma
│  ├─ catalog/             # NestJS — categories, products, sizes, toppings, images, stock
│  │  └─ prisma/schema.prisma
│  ├─ ordering/            # NestJS — quotes, orders, state machine, promotions, loyalty
│  │  └─ prisma/schema.prisma
│  └─ payment/             # NestJS — payments, Stripe Checkout, webhooks, refunds
│     └─ prisma/schema.prisma
├─ packages/
│  ├─ contracts/           # client-safe shared values: enums, error codes, permissions, limits,
│  │                       #   pricing, event subjects + zod payloads, .proto files + generated gRPC code
│  ├─ nest-common/         # server-only Nest building blocks: rpcError, gRPC client base, outbox,
│  │                       #   JetStream consumer, config loader, logger, health, caller context
│  ├─ api-client/          # Orval-generated fetch client + zod schemas, from the gateway's OpenAPI
│  └─ config/              # tsconfig, eslint, nest-cli (SWC), vitest presets; markdownlint rule; guard specs
├─ infra/
│  └─ docker/              # compose.yaml, Dockerfile.service, Dockerfile.web, postgres-init/, firebase/
└─ docs/
```

- There is no shared React package and no framework-free `core` package: one app has no second consumer for either. **Adding a shared package requires a second consumer.**
- `packages/contracts` is imported by the web app, so it **must not** import `node:*` or any Node-only package. Anything needing `node:crypto` lives in `packages/nest-common`.
- Services never import each other. They share only `contracts` and `nest-common`.

### 1.2 Running beside other projects

📌 [ADR 0027](./decisions/0027-host-ports-sit-in-the-2xxxx-range.md). This machine runs other stacks (Wayfare on `1xxxx`, Synapsedesk on its own set), so every host port BrewLite publishes is in the **2xxxx** range and every container is named `brewlite-<name>`. Inside the Compose network everything keeps its default port (`postgres:5432`, `nats:4222`). Every host port is published on `127.0.0.1` — nothing BrewLite runs is meant to be reachable from outside this machine. ⚠️ Run `docker compose` from the repository root, where `compose.yaml` sets `name: brewlite`; from `infra/docker` pass `-p brewlite`, or Compose creates a second project and network (`docker_default`) beside the running one. ⚠️ To stop the `apps` containers, stop them by name — `docker compose stop identity catalog gateway` — never `docker compose --profile apps down`, which removes the **whole** project, infrastructure included.

| Component | Host port | In-network |
| :---- | :---- | :---- |
| `web` (Next.js) | 23000 | `web:23000` |
| `gateway` HTTP | 23100 | `gateway:23100` |
| `identity` / `catalog` / `ordering` / `payment` ops HTTP (`/health*`) | 23101 / 23102 / 23103 / 23104 | same |
| `identity` / `catalog` / `ordering` / `payment` gRPC | 25051 / 25052 / 25053 / 25054 | same |
| PostgreSQL | 25432 | `postgres:5432` |
| Redis | 26379 | `redis:6379` |
| NATS client / monitoring | 24222 / 28222 | `nats:4222` / `nats:8222` |
| NATS test broker | 24223 | `nats-test:4222` |
| Firebase Emulator UI / Auth / Storage / Hub | 29000 / 29099 / 29199 / 29400 | same ports inside |

- gRPC ports sit below the OS's ephemeral range (Linux 32768–60999), so no outgoing connection can be holding one when a service starts.
- ⚠️ The Firebase emulators listen on the **same** port inside and outside the container (set in `infra/docker/firebase/firebase.json`): the Storage emulator writes its own host and port into download URLs, and a remapped port produces URLs that point nowhere.
- The Firebase emulators are **infrastructure**, like Postgres and Redis — a plain `docker compose up` (no `apps` profile) starts them, since identity's Firebase Auth tests and catalog's Storage tests both need them without building or running any service image.

---

## 2. Backend

### 2.1 Services

📌 [ADR 0004](./decisions/0004-the-backend-is-a-gateway-plus-four-domain-services.md).

| Service | Database | gRPC package | Publishes | Consumes |
| :---- | :---- | :---- | :---- | :---- |
| `gateway` | none | client of all four | — | `ordering.order.status_changed` (SSE fan-out, non-durable) |
| `identity` | `brewlite_identity` | `brewlite.identity` | — | — |
| `catalog` | `brewlite_catalog` | `brewlite.catalog` | — | `ordering.order.status_changed` |
| `ordering` | `brewlite_ordering` | `brewlite.ordering` | `ordering.order.status_changed`, `ordering.payment.rejected` | `payment.payment.succeeded`, `payment.payment.failed`, `payment.refund.succeeded`, `payment.refund.failed` |
| `payment` | `brewlite_payment` | `brewlite.payment` | `payment.payment.succeeded`, `payment.payment.failed`, `payment.refund.succeeded`, `payment.refund.failed` | `ordering.order.status_changed`, `ordering.payment.rejected` |

The full event and RPC contracts are in [`api-endpoints-plan.md`](./api-endpoints-plan.md) §8–9.

- **Framework:** **NestJS 11**. Backend services are **hybrid apps**: a gRPC microservice plus a small HTTP listener on `OPS_PORT` for `/health`, `/health/ready` and `/version`.
- **Gateway:** the only process reachable from outside the Compose network. It verifies the access token, checks the role's permission, validates the request with zod, applies rate limits, calls one service over gRPC, and maps the answer to a response DTO. **It holds no business rule and no database.**
- **Clients of the gateway:** the Next.js server, and Stripe's webhook. **Browsers never call the gateway directly** ([ADR 0014](./decisions/0014-the-web-server-is-the-gateways-only-client.md)) — so the gateway needs no CORS configuration and no cookies; it speaks bearer tokens only.

### 2.2 Synchronous calls — gRPC

📌 [ADR 0005](./decisions/0005-grpc-for-synchronous-calls-and-jetstream-for-events.md).

- `@nestjs/microservices` + `@grpc/grpc-js`. `.proto` files live in `packages/contracts/proto/brewlite/<service>/`; **ts-proto** (with its NestJS output) generates the TypeScript for both ends, through **`buf generate`** (options `nestJs`, `addGrpcMetadata`, `useDate=false`, `esModuleInterop`, `stringEnums`, `forceLong=string`); `buf lint` runs in CI with `STANDARD` minus `PACKAGE_VERSION_SUFFIX` — packages are `brewlite.<service>`, unversioned. Messages shared by two services (`LocalizedText`) live in `brewlite.common`. Generated code is committed and regenerated in CI with a diff check.
- Use gRPC when **the caller needs the answer to continue**: pricing a cart, reserving stock, checking an order is payable.
- Every call goes through `BaseGrpcClient` from `nest-common`: a **2 s deadline** (one exception: the gateway gives `CreatePayment` **12 s**, because it may wait on Stripe — itself bounded at 6 s — after a 2 s `BeginPayment`), the caller context and `x-request-id` as metadata, and connection failures mapped to `UNAVAILABLE`.
- ⚠️ A stopped container does not refuse a connection; it stays silent until the deadline. A deadline on a channel that never connected is reported as `503 UPSTREAM_UNAVAILABLE`, not `504` — the peer is down, not slow.

### 2.3 Asynchronous events — NATS JetStream

📌 [ADR 0005](./decisions/0005-grpc-for-synchronous-calls-and-jetstream-for-events.md) · [ADR 0006](./decisions/0006-events-leave-through-a-transactional-outbox.md).

- **Every event goes through JetStream**, never core NATS: a consumer restart must not lose "this order was paid".
- **Every event leaves through a transactional outbox.** The service writes an `outbox_events` row in the same transaction as the state change; a relay publishes unpublished rows with `Nats-Msg-Id = outbox id`. A crash between commit and publish then delays an event instead of losing it.
- **Every consumer is idempotent by construction** — a conditional update (`WHERE status = 'PENDING'`) or a unique key (`UNIQUE (order_id, kind)`) makes a redelivery a no-op. No service needs a `processed_events` table; if a future consumer cannot be made idempotent this way, it adds one.
- Streams: `ORDERING` (`ordering.>`), `PAYMENT` (`payment.>`), `DLQ` (`dlq.>`). Event streams keep 7 days with a 2-minute duplicate window; `DLQ` keeps 30 days with the same window (NATS applies its own 2-minute default for an unset duplicate window anyway — stating it explicitly keeps `ensureStreams`' comparison stable across restarts). Durable consumer names are `<service>-<subject with dots as dashes>`, max 10 deliveries, then a dead letter.
- **`ensureStreams(jsm, names)` runs at boot on both ends** — a publisher ensures its own stream, a consumer ensures the stream it reads and `DLQ`, so boot order between two services never matters. Missing → create. Present → compare `subjects`/`max_age`/`duplicate_window`/`storage`, throwing at boot on any difference, naming the field — a changed stream config is a decision made by hand, never a deploy side effect.
- **The relay is the only publisher.** One cycle claims a batch (`FOR UPDATE SKIP LOCKED`, `ORDER BY id`), publishes each row with `Nats-Msg-Id = outbox id`, and stops at the first failure so one aggregate's events keep their order. Pacing: a full batch claims again at once; otherwise it waits `OUTBOX_POLL_MS`; consecutive failures back off exponentially to 10 s. The claim transaction's timeout is computed — `OUTBOX_BATCH_SIZE × OUTBOX_PUBLISH_TIMEOUT_MS + 5,000` — never configured separately, so a slow broker can't expire it and force a mass republish.
- **A consumer's redelivery schedule** (`nak(delay)`) grows by delivery count — `[1 s, 5 s, 30 s, 2 min, 5 min]`, the last entry repeating — before the final delivery dead-letters. The dead-letter copy carries the original headers plus `x-dlq-error` (the failure message, newlines stripped, truncated to 500 chars) and is the one publish outside the relay: it is not a domain event and has no transaction to ride in.
- The gateway's SSE fan-out is the one **non-durable** consumer: an ordered, ephemeral consumer per gateway process, new messages only. It feeds one in-process RxJS `Subject` that every open stream subscribes to, so one NATS subscription serves every browser. A frame failing its schema is logged and dropped — an ephemeral consumer has no dead-letter queue. A missed frame costs latency, never data — the browser refetches on reconnect ([ADR 0022](./decisions/0022-order-updates-reach-browsers-as-server-sent-events.md)).

### 2.4 API documentation, validation and the client

📌 [ADR 0011](./decisions/0011-zod-is-the-only-schema-language-and-orval-generates-the-client.md).

```text
zod schema (gateway dto/) ─nestjs-zod─▶ DTO class + runtime validation
                          ─@nestjs/swagger + cleanupOpenApiDoc─▶ openapi.json (committed)
                          ─Orval─▶ packages/api-client: typed fetch functions + zod schemas
                          ─▶ apps/web (Server Components, Server Actions)
```

- Request and response shapes are **zod schemas**, turned into Nest DTOs by **nestjs-zod**, so the schema that validates is the schema that is documented.
- `pnpm --filter @brewlite/gateway openapi:emit` builds the OpenAPI document **without listening** and writes `services/gateway/openapi.json`, **formatted with Prettier** so it matches `format:check` byte for byte. That file is committed; CI regenerates it and the Orval output and fails on any diff. A backend change that breaks the client **fails the web app's type check**.
- **Orval** generates `packages/api-client` with the `fetch` client and one mutator, and zod schemas the web app reuses for forms. No TanStack Query hooks. Two entry points: **`@brewlite/api-client`** (`import 'server-only'` — a Client Component importing it fails the build) and **`@brewlite/api-client/zod`** (schemas only, client-safe). The package imports nothing from Next.js: the web app calls `configureApiClient({ baseUrl, getRequestHeaders })` once and supplies the bearer token, `X-Request-Id` and `X-Forwarded-For`. Every generated function resolves to `{ data, status, headers }`, where `data` is the gateway's body **with its `{ data, meta }` envelope intact**; a non-2xx throws `ApiClientError { status, code, details, requestId }`. A request's `Idempotency-Key` goes in the call's `options.headers`.
- The gateway's `openapi.json` is **OpenAPI 3.1** — zod's JSON Schema output is 3.1-only, and a document labelled 3.0 is invalid.
- **Prefix and versioning:** `GLOBAL_PREFIX` (`api`) + Nest URI versioning, `defaultVersion: '1'` → `/api/v1/...`. A breaking change versions one route, never the API. Ops routes and the Stripe webhook are version-neutral.
- Swagger UI at `/docs`, JSON at `/docs-json` — off in production.

### 2.5 Layers inside a service

📌 [ADR 0008](./decisions/0008-services-query-prisma-7-directly.md) — there is **no repository layer**.

```text
DOMAIN SERVICE (identity, catalog, ordering, payment)
┌──────────────────────────────────────────────────────────────────┐
│ PRESENTATION  <module>-grpc.controller.ts | <module>.consumer.ts │
│   unpack the request / event, delegate once, return              │
├──────────────────────────────────────────────────────────────────┤
│ BUSINESS+DATA <module>.service.ts                                │
│   use cases, transactions, Prisma queries, outbox writes;        │
│   throws rpcError(code), never an HTTP exception                 │
│   uses domain/*.ts — pure rules: state machine, pricing, promo   │
├──────────────────────────────────────────────────────────────────┤
│ DATA          PrismaService → PostgreSQL                         │
└──────────────────────────────────────────────────────────────────┘
      <entity>.mapper.ts: Prisma row → proto message, field by field

GATEWAY (no database)
  <module>.controller.ts → <module>.service.ts → <peer>-service-grpc.client.ts
                                   └─────────→ <entity>.mapper.ts: proto ⇄ response DTO
```

- The pure rules of Task 10 — `assertTransition`, `computeUnitPrice`, `applyPromotion`, `pointsEarned` — are plain functions in `domain/` (or `packages/contracts` when the web app needs them too) with **no Nest and no Prisma import**, unit-tested without a framework.
- The gateway returns explicit response DTOs built by mappers. A Prisma row or a proto message is never returned as-is — that is how `password_hash` ends up in JSON.

### 2.6 Rate limiting, caching and background work

📌 [ADR 0023](./decisions/0023-redis-holds-only-reconstructible-state.md). One Redis, three jobs, all reconstructible:

- **Rate limits** — the gateway's own `RateLimitGuard` (conventions §6.3), not `@nestjs/throttler`: a fixed window on ioredis, `INCR` + `PEXPIRE NX` per key `gw:rl:<class>:<kind>:<value>`, so limits hold across replicas. Classes in api-endpoints-plan §0.8. A Redis error fails **open** with one `error` log line — a rate limiter must not take the shop down — so the gateway declares no readiness dependency on Redis.
- **Cache** — catalog caches the public menu (`catalog:menu`) and deletes the key after every catalog write commits — one rule, every category/product/topping/stock write, not a per-write decision of whether the cache would show it — and when a product's stock crosses zero. `MENU_CACHE_TTL_MS` is only the backstop. A cache read or write never fails the request it backs: on any Redis error the call logs one `warn` and falls back to the database — a failed invalidation never fails the write that triggered it. **The web app caches no API data**: one cache layer, one place to invalidate.
- **`/health/ready` lists only what a service cannot serve without.** Catalog's menu reads survive a Redis outage (the line above) — Redis and NATS join catalog's and ordering's readiness because their background jobs need them, not because a request path does. Identity's readiness needs Redis alone (`sessions-prune`); the gateway needs neither yet — its own future NATS consumer (server-sent updates) will add it later. The NATS check reads the connection's own live status (its `status()` stream of disconnect/reconnect events — `isClosed()` alone only reflects a *permanently* dead connection, not an active outage during auto-reconnect); the Redis check is a `PING` on the jobs connection, bounded to 500 ms so a hung connection can't hang the probe.
- **Background jobs** — **`bullmq`** directly (no `@nestjs/bullmq`), through `JobsModule.forRoot({ queue, jobs })` in nest-common. At boot it calls `queue.upsertJobScheduler(name, { every }, { name })` for each job — a stable scheduler id, so every replica registers the *same* schedule and only one of them picks up each tick — and runs one `Worker` that dispatches by job name to the class's `run()`. Never `@Cron`, which fires once per replica:

| Job | Service | Every | Does |
| :---- | :---- | :---- | :---- |
| `orders-expire` | ordering | 1 min | cancels `PENDING` / `PAYMENT_FAILED` orders past `expires_at` |
| `reservations-release-orphans` | catalog | 15 min | releases `HELD` reservations older than `RESERVATION_ORPHAN_TTL_MS` |
| `outbox-prune` | ordering, payment | daily | deletes outbox rows published more than 7 days ago |
| `sessions-prune` | identity | daily | deletes expired sessions |

- A job is a class with `run(now = new Date())`, so a test calls it directly and never starts a worker. `pnpm job:run <name>` boots the app once, runs one job, exits — used by the sweep's own DoD check and by an operator.
- **`orders-expire` puts `expiresAt <= now` inside the conditional update itself, not only in its select.** a future payment attempt raises `expires_at` when it starts; with the deadline inside the `WHERE`, a payment that starts in the same second as the expiry tick wins the race, and the tick's own update matches nothing.
- **`JobsModule` builds its own Redis connection from `REDIS_URL`, never the cache's or the rate limiter's client.** BullMQ requires `maxRetriesPerRequest: null` and waits for Redis instead of failing fast — the opposite of those two — and pins its own `ioredis` major. The connection must be explicitly `quit()` on shutdown: BullMQ never closes a connection it didn't create itself.
- ⚠️ Redis is not a database. `FLUSHALL` must leave the system correct: rate limits reset, the menu is re-read, repeatable jobs are re-registered at boot.

### 2.7 Identifiers

📌 [ADR 0009](./decisions/0009-every-identifier-is-a-uuidv7.md). Every id is a **UUIDv7**, generated by the application (`@default(uuid(7))`, or `newId()` from `contracts`), validated as v7 at every edge — including `Idempotency-Key`. The number people read, `#1042`, is a separate column from a sequence.

---

## 3. Data

### 3.1 PostgreSQL — one server, a database per service

📌 [ADR 0007](./decisions/0007-one-postgres-server-with-a-database-per-service.md).

One Postgres 18 container (`brewlite-postgres`); its init script creates three databases per service:

```text
identity → brewlite_identity + brewlite_identity_test + brewlite_identity_shadow
catalog  → brewlite_catalog  + brewlite_catalog_test  + brewlite_catalog_shadow
ordering → brewlite_ordering + brewlite_ordering_test + brewlite_ordering_shadow
payment  → brewlite_payment  + brewlite_payment_test  + brewlite_payment_shadow
```

- The **test** database has the same schema and is the only one integration tests touch. The **shadow** database is used only by the drift check.
- `DATABASE_URL_TEST` differs from `DATABASE_URL` only in the database name.
- ⚠️ **No cross-service transaction, join or foreign key.** `ordering.orders.user_id` is a plain UUID with no constraint. A write that spans services is a local write plus an event, and the design must hold in the window where they disagree (rdm-spec §1.2).

### 3.2 Prisma 7

📌 [ADR 0008](./decisions/0008-services-query-prisma-7-directly.md). Each service owns `services/<svc>/prisma/schema.prisma`, its migrations and its generated client — so `ordering` cannot even *type* a query against `identity.users`.

⚠️ Prisma 7 differs from most tutorials:

- **Driver adapters are required:** `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
- The generator is **`prisma-client`** with an explicit `output` — ours is `../generated/prisma` (outside `src/`, git-ignored) — and **`moduleFormat = "cjs"`**.
- **The URL is not in `schema.prisma`.** It lives in `prisma.config.ts`, which imports `dotenv/config` (Prisma no longer loads `.env`).
- `migrate dev` no longer runs `generate` or the seed; both are explicit scripts.
- ⚠️ The SWC builder compiles only `src/` unless told otherwise: each service's `nest-cli.json` sets `compilerOptions.builder: { type: 'swc', options: { filenames: ['src', 'generated'] } }` — nested under `options`, not top-level — or `dist` has no Prisma client. Both directories keep their prefix in `dist`, so the entry point is **`dist/src/main.js`**.
- ⚠️ **Prisma 7.10's generator can emit relative imports with a literal `.ts` extension** (seen on identity's and ordering's schemas, not catalog's, with the same generator block). SWC does not rewrite import specifiers, so the built image fails with `Cannot find module './internal/class.ts'` — and only the Docker build shows it. A service whose generated client has them chains `brewlite-fix-prisma-imports` — a `bin` of `packages/config`, taking the service directory — onto its `db:generate`, rewriting `./x.ts` to `./x.js` before SWC runs. Shared across services rather than duplicated per service (development-conventions §3.1). Remove it when a Prisma release fixes the generator.

The template every service copies:

```ts
// services/<svc>/prisma.config.ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

const TARGETS = { working: 'DATABASE_URL', test: 'DATABASE_URL_TEST' } as const;
const db = process.env.PRISMA_DB ?? 'working';
if (!Object.hasOwn(TARGETS, db)) throw new Error(`Unknown PRISMA_DB "${db}"`);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: env(TARGETS[db as keyof typeof TARGETS]),
    shadowDatabaseUrl: env('DATABASE_URL_SHADOW'),
  },
});
```

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}
```

- Whatever Prisma cannot express — partial unique indexes, `CHECK` constraints, sequences — lives in `services/<svc>/prisma/sql/schema-objects.sql`, applied after `migrate deploy` by `pnpm db:objects` (rdm-spec §2.8).
- `@default(uuid(7))` works on Prisma 7.10 (verified). 🔬 Still to verify: `autoincrement()` on a non-id column (the order number).

### 3.3 Redis

One Redis 8 container, `maxmemory-policy noeviction` (BullMQ requires it). Key prefixes: `catalog:` (cache), `gw:rl:` (rate limits), `bull:` (queues). Every value is reconstructible (§2.6).

### 3.4 Product images — Firebase Storage

📌 [ADR 0025](./decisions/0025-product-images-live-in-firebase-storage.md).

- An admin uploads through the gateway (`multipart/form-data`, ≤ `PRODUCT_IMAGE_MAX_BYTES`); the gateway passes the bytes to catalog over gRPC; catalog **checks the magic bytes** (JPEG, PNG or WebP — never the extension or the declared type), writes `products/<productId>/<newId>.<ext>` with `firebase-admin`, stores the path, and deletes the previous image — **in that order**: the new object exists before the row points at it, and the old object is deleted only after the row commits, so no moment has the row pointing at nothing. A crash between the upload and the write, or a failed old-object delete, leaves an accepted orphan object — never a broken image; a bucket sweep is P2.
- Clients read images at `${STORAGE_PUBLIC_BASE_URL}/v0/b/<bucket>/o/<encoded path>?alt=media`. Storage security rules **allow public read of `products/**` and deny every write** — the Admin SDK bypasses rules, so only catalog can write.
- Locally the **Firebase Storage emulator** stands in for the bucket (`FIREBASE_STORAGE_EMULATOR_HOST`); the same code runs against both.
- ⚠️ A user-supplied filename never becomes an object name.

---

## 4. Frontend — `apps/web`

📌 [ADR 0014](./decisions/0014-the-web-server-is-the-gateways-only-client.md) · [ADR 0015](./decisions/0015-nextjs-server-features-replace-client-data-libraries.md) · [ADR 0026](./decisions/0026-the-ui-is-tailwind-with-daisyui.md).

### 4.1 Stack

- **Next.js 16, App Router, React 19**, TypeScript strict. Compiled by Next's SWC toolchain.
- **Server Components** fetch data through the generated client, **Server Actions** perform mutations, **Route Handlers** proxy the SSE streams. **No TanStack Query, no Zustand.**
- **Styling:** **Tailwind CSS 4 + DaisyUI 5** — themed components (`btn`, `card`, `badge`, `modal`, `drawer`, `steps`) cover every screen of the wireframe without a component library dependency. One BrewLite theme.
- **Forms:** plain `<form action={serverAction}>` with `useActionState`; the Orval-generated zod schema validates on the server (and optionally on the client for instant feedback). No form library.
- **Languages:** the UI speaks **English (default) and Vietnamese** through **i18next** (§4.7); the code and the docs are English.
- **Routes:** route groups `(customer)`, `staff/`, `admin/`, each with its own layout; see product-overview §3.
- **Installable PWA** ([ADR 0032](./decisions/0032-the-web-app-is-an-installable-pwa-whose-service-worker-caches-no-data.md)): `app/manifest.ts`, and one hand-written `public/sw.js` that caches **only** content-hashed `/_next/static/*`, icons and fonts, and serves an offline page when a navigation fails. Documents, Server Actions, Route Handlers (the event streams) and cross-origin requests always go to the network.

### 4.2 The web server is the BFF

```text
browser ──cookies──▶ Next.js server ──Bearer + X-Request-Id──▶ gateway ──gRPC──▶ services
                        │ proxy.ts: refresh the access token; send guests to sign in; gate /staff and /admin
                        │ Server Components: GET through the generated client
                        │ Server Actions: POST/PATCH/DELETE through the generated client
                        └ Route Handlers: /api/events/* — proxy the SSE streams
```

- Tokens live in **`httpOnly`, `SameSite=Lax`** cookies on the web origin — `bl_at` (access, 15 min) and `bl_rt` (refresh, 30 days), `Secure` outside development. **Browser JavaScript never sees a token.**
- The generated client runs **only on the server** (`@brewlite/api-client` imports `server-only`). `API_URL` is a server-only variable, never `NEXT_PUBLIC_`.
- **`proxy.ts`** (Next 16's name for middleware) does three things, in order:
  1. **Refresh:** when `bl_at` is missing or expired and `bl_rt` exists, call `POST /auth/refresh` and set fresh cookies. A refresh answered `401` (expired session, locked or deactivated account) clears both cookies — the visitor is a guest again.
  2. **Guests to sign-in** ([ADR 0029](./decisions/0029-guests-browse-and-build-a-cart-and-sign-in-only-to-order.md)): with no session, a request for `/checkout`, `/orders*` or `/account` is redirected to `/login?next=<path>`. Everything else — the menu, product pages, the cart, sign-in and registration — renders for a guest. After sign-in the Server Action redirects to `next` only if it is a **relative path** (starts with one `/`, not `//`, no `\`); anything else goes to `/`, so the parameter cannot become an open redirect.
  3. **Roles:** a request for `/staff*` or `/admin*` whose token role lacks access is redirected to `/`.

  The layouts re-check server-side — the proxy is the fast path, not the guard.
- ⚠️ **A Server Component cannot set cookies.** Refreshing inside a page render silently does nothing; refresh belongs in `proxy.ts`, and sign-in and sign-out in Server Actions.
- **Server Actions are CSRF-protected by Next** (they are `POST`-only and check `Origin` against the host). Route Handlers that change state do not exist — mutations go through Server Actions.
- The gateway's authorization is the real authorization. Hiding a button is UX; the route refuses.

### 4.3 Client state — the cart

- The cart is a React Context provider in the `(customer)` layout, persisted to `localStorage` (wrapped in `try/catch`; a blocked storage degrades to an in-memory cart). It holds lines only — `productId`, size, `toppingIds`, quantity — plus the price snapshot shown in the preview.
- The preview total uses `computeUnitPrice` from `packages/contracts`, the same function catalog uses. **The checkout page shows the server's quote, never the preview.**
- The cart is cleared when the confirmation page sees `PAID` — not when payment starts — so a failed payment keeps it (product-overview F2).
- **The cart belongs to the browser, not the account** (product-overview §6.8): a guest's cart survives the sign-in round trip untouched. **Sign-out clears it** — the sign-out button is a Client Component that clears the cart, then calls the sign-out Server Action (a Server Action cannot reach `localStorage`).

### 4.4 Sign-in with Google and Apple

📌 [ADR 0013](./decisions/0013-identity-issues-brewlite-tokens-and-firebase-only-proves-sign-ins.md).

1. The login page (a Client Component) runs the **Firebase JS SDK** popup for Google or Apple.
2. It passes the Firebase **ID token** to a Server Action, which calls `POST /auth/firebase`.
3. identity verifies the ID token with `firebase-admin`, finds or creates the BrewLite user, and returns BrewLite tokens; the Server Action sets the cookies.
4. The page signs out of Firebase. **Firebase keeps no session for BrewLite** — BrewLite's own cookies are the session.

Locally the SDK talks to the **Firebase Auth emulator**, which offers fake Google and Apple accounts — no real Google project needed to develop.

### 4.5 Payment UI

- Checkout calls a Server Action → `POST /payments` → the response says which provider:
  - **`STRIPE`** → a Client Component mounts Stripe's **embedded Checkout** with the returned `clientSecret` (`@stripe/stripe-js`, `@stripe/react-stripe-js`). Card and wallet choice happen inside Stripe's UI. On completion Stripe returns to `/orders/[id]?payment=<paymentId>`.
  - **`FAKE`** → the page shows *Simulate success* / *Simulate failure*, which call `POST /payments/:id/fake-confirm`.
- The confirmation page **never decides the outcome.** It reads the order and follows the SSE stream until the webhook-driven status arrives.
- ⚠️ The Stripe **publishable** key is the only Stripe value in the web app (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`). Pages that load Stripe.js need `https://*.stripe.com` in the CSP's `script-src`, `frame-src` and `connect-src`.

### 4.6 Live order status

📌 [ADR 0022](./decisions/0022-order-updates-reach-browsers-as-server-sent-events.md).

- The tracking page and the staff board open an `EventSource` to a Route Handler (`/api/events/orders/[id]`, `/api/events/staff`), which reads the cookie and streams the gateway's SSE response through (`dynamic = 'force-dynamic'`).
- Each event only says *order X is now status Y*. The page applies it, and on every (re)connect calls `router.refresh()` to re-read the truth — a dropped connection loses latency, never state.

### 4.7 Internationalisation — English and Vietnamese

📌 [ADR 0028](./decisions/0028-the-ui-speaks-english-and-vietnamese-through-i18next.md).

- **Libraries:** **`i18next`** + **`react-i18next`**, with **`i18next-resources-to-backend`** loading one JSON file per namespace on demand. No routing library, no locale in the URL.
- **Locales:** `en` (default) and `vi` — `SUPPORTED_LOCALES` / `DEFAULT_LOCALE` in `packages/contracts`. **English is the source language:** a key is written in `en` first, and `vi` must have every key `en` has (a test fails otherwise).
- **Resources:** `apps/web/src/i18n/locales/<locale>/<namespace>.json` — namespaces `common`, `menu`, `cart`, `checkout`, `orders`, `account`, `auth`, `staff`, `admin` and `errors`. They live in the web app because it is their only consumer; servers send codes, never sentences.
- **Resolving the locale, per request:** the `bl_locale` cookie if it holds a supported value, otherwise `en`. The browser's `Accept-Language` is deliberately ignored — English is the default by decision.
  - The header's switch calls a Server Action that sets `bl_locale` (1 year, not `httpOnly` — it is a preference, not a secret) and, for a signed-in user, saves it with `PATCH /users/me { preferredLocale }`.
  - Signing in sets `bl_locale` from the account's `preferredLocale`, so the choice follows the customer to a new device.
- **Server Components** translate with `getT(namespace)` — a per-request i18next instance (`createInstance()`, memoised with React `cache()`), never a module-level singleton, which would leak one visitor's language into another's render.
- **Client Components** use `useTranslation(namespace)` under an `I18nProvider` in the root layout, initialised with the same locale and the resources the server already loaded, so the first client render matches the server's HTML.
- `<html lang>` is the resolved locale.
- **Errors:** an API error code is rendered with `t('errors:<CODE>', details)` — `details` interpolate (`Only {{available}} left`). A code missing from `errors` falls back to `errors:UNKNOWN`, never to the raw code.
- **Plurals** use i18next's `_one` / `_other` keys; Vietnamese has only `_other`. Never `count === 1 ? … : …`.
- **Money and dates:** `formatVnd(amount, locale)` — `Intl.NumberFormat` with `currency: 'VND'`, giving `₫123,000` in `en` and `123.000 ₫` in `vi` — and `formatDateTime(iso, locale)`, always in `Asia/Ho_Chi_Minh`. Both in `apps/web/src/i18n/format.ts`. The currency never changes with the locale.
- **Menu content is bilingual data** ([ADR 0031](./decisions/0031-menu-content-is-written-in-english-and-vietnamese.md)): the API returns every name and description as `LocalizedText = { en, vi }`, and the web app renders it with `localized(text, locale)` from `apps/web/src/i18n/format.ts`. It is data, never a translation key. The menu cache stays one entry for both languages.
- 🔬 Verify at scaffold: the pinned `i18next` / `react-i18next` majors and their App Router pattern (server `getT` + client provider) on Next 16.

---

## 5. Identity and security

- **Passwords:** **bcrypt** via `bcryptjs` (pure JavaScript — no native build in Alpine images), cost 12. bcrypt reads at most 72 bytes, so a password is 8–72 **bytes** and the limit is checked in bytes, not characters. Login for an unknown email still runs one compare against a dummy hash, so timing does not reveal which emails exist.
- **Access tokens:** JWT, **ES256**, signed by identity with `JWT_PRIVATE_KEY` and verified by the gateway with `JWT_PUBLIC_KEY` only — the gateway can verify, never mint. `@nestjs/jwt`. Claims: `sub` (user id), `role`, `sid` (session id), `iss: brewlite-identity`, `aud: brewlite-gateway`, `exp` = 15 min.
- **Refresh tokens:** 32 random bytes, base64url, stored only as a **SHA-256** hash in `sessions` (rdm-spec I-2), 30-day lifetime, **not rotated** — see [ADR 0014](./decisions/0014-the-web-server-is-the-gateways-only-client.md) for why rotation buys little when the token never leaves an `httpOnly` cookie, and what it would cost.
- **Revocation:** sign-out deletes the session; a role change, a lock or a deactivation deletes all of the user's sessions, and sign-in and refresh refuse a locked or deactivated account. An access token already issued stays valid until it expires — **at most 15 minutes**, stated and accepted.
- **Authorization:** three fixed roles, a static permission catalogue in `packages/contracts`, and `ROLE_PERMISSIONS` mapping one to the other in code ([ADR 0016](./decisions/0016-three-fixed-roles-and-a-compile-time-permission-catalogue.md)). Routes declare a **permission**, never a role.
- **Google/Apple sign-in:** identity verifies the Firebase ID token with `firebase-admin`, then finds or links the account by verified email (ADR 0013) — Firebase only proves a sign-in, identity still issues its own tokens. `firebase-admin` accepts an **unsigned** token whenever `FIREBASE_AUTH_EMULATOR_HOST` is set, so identity **refuses to boot** when `NODE_ENV=production` and that variable is set — a forged token for any email would otherwise be accepted.
- **Caller context:** the gateway passes `x-user-id`, `x-user-role` and `x-request-id` to services as gRPC metadata. Services trust it — they are unreachable except through the gateway — and **every ownership check happens in the service**, scoped in the query (`WHERE id = $1 AND user_id = $2`).
- **Gateway guard order:** `AuthGuard → PermissionGuard → RateLimitGuard`, applied globally so no route opts out by omission. Route markers (`@Auth`, `@RequirePermission`, `@RateLimit`) live in `packages/nest-common` (conventions §6.3), since `OpsController` there needs them too; the guards that read them are the gateway's own. A boot-time check refuses to start the gateway if any route is missing a marker.
- **HTTP hardening:** `helmet` on the gateway; strict CSP on the web app; `trust proxy` set to the exact hop count.
- **Secrets:** `.env` locally (git-ignored, with a committed `.env.example` per app), GitHub Actions secrets in CI. Never in source, never in logs. `NEXT_PUBLIC_*` is compiled into the browser bundle — public values only.

---

## 6. Payments — Stripe 🎓

📌 [ADR 0017](./decisions/0017-stripe-checkout-is-the-payment-surface.md) · [ADR 0002](./decisions/0002-every-amount-is-an-integer-number-of-dong.md).

- **API:** **Checkout Sessions**, `mode: 'payment'`, **embedded** UI. One line item — *BrewLite order #1042* — with `price_data` for the order's total in **VND**, so a discount can never disagree with Stripe's arithmetic. `client_reference_id` and `metadata` carry the payment id and order id. `expires_at` = now + `CHECKOUT_SESSION_TTL_MS`. Embedded Checkout is **`ui_mode: 'embedded_page'`** on the pinned version (read from the SDK's types; `integration_identifier` is optional and not sent).
- **VND is zero-decimal:** the Stripe `amount` is the đồng total as-is. Never multiply by 100.
- **Never pass `payment_method_types`.** Methods (card, Google Pay, Apple Pay, Link) are chosen in the Dashboard; Stripe shows what fits the device.
- **Server SDK:** `stripe` for Node — `new Stripe(key, { apiVersion })` with the version pinned in code (pinned: `2026-08-26.dahlia`, `STRIPE_API_VERSION` beside the provider). Never the global-key pattern.
- **Keys:** a **restricted** key (`rk_test_…`) with Checkout Sessions write, Refunds write and Events read — never a full `sk_`. `PAYMENT_PROVIDER=stripe` requires `STRIPE_SECRET_KEY` (any prefix but `rk_` fails env validation), `STRIPE_WEBHOOK_SECRET` and `WEB_URL`. Test mode only (product-overview §12).
- **Idempotency:** the `Idempotency-Key` of `POST /payments` is forwarded as Stripe's idempotency key on `checkout.sessions.create`; a refund uses its own row id.
- **Webhook:** `POST /api/webhooks/stripe` (version-neutral) on the gateway, forwarded with the **raw body** and the `Stripe-Signature` header to payment, which verifies the signature before anything else, inserts the event id (duplicate → acknowledged, nothing done), and applies it in one transaction with its outbox row. Handled events: The P-3 row and the event's effect share **one** transaction: a failed effect leaves no P-3 row, so Stripe's retry is processed; an event for a session we do not know is logged and answered `200`, since retrying it can never succeed. A replay of a `PENDING` payment re-reads the client secret from the session (it is never stored) and answers `null` once the session is no longer open.

| Stripe event | Effect |
| :---- | :---- |
| `checkout.session.completed` with `payment_status` ≠ `unpaid` | payment `SUCCEEDED` → `payment.payment.succeeded` |
| `checkout.session.async_payment_succeeded` | same |
| `checkout.session.async_payment_failed` | payment `FAILED` → `payment.payment.failed` |
| `checkout.session.expired` | payment `EXPIRED` → `payment.payment.failed` (`reason: EXPIRED`) |
| `refund.updated` | refund `SUCCEEDED` / `FAILED` → `payment.refund.succeeded` / `payment.refund.failed` — `succeeded`, or `failed` / `canceled`; any other status changes nothing |

- ⚠️ **The SDK's own `timeout` does not fire when Stripe is unreachable** — the call hangs. Payment wraps every Stripe call in its own **6 s** deadline (`STRIPE_TIMEOUT_MS`) and answers `503 PAYMENT_PROVIDER_UNAVAILABLE`.
- ⚠️ Nest parses JSON bodies by default; signature verification needs the **raw body**. Create the gateway with `rawBody: true` and read `req.rawBody` on the webhook route.
- ⚠️ **Fulfil from the webhook, never from the return page.** A customer can pay and close the tab.
- **Local development:** `stripe listen --forward-to localhost:23100/api/webhooks/stripe` — its printed `whsec_…` goes into payment's `STRIPE_WEBHOOK_SECRET`. No Stripe account yet? `stripe sandbox create`. ⚠️ The CLI must be logged in to the **same** account as `STRIPE_SECRET_KEY`, or no webhook arrives. An embedded session has no hosted page to open, so paying one needs a page that mounts it — the web app's checkout, or a throwaway local page with the publishable key.
- **Fake provider:** `PAYMENT_PROVIDER=fake` swaps Stripe for an in-process provider behind the same `PaymentProvider` interface. `fake-confirm` produces exactly the events the webhook would. Refused in production. The switch fails env validation with `NODE_ENV=production` — a setting that lets anyone mark an order paid must be impossible there, not merely unused — so the `apps` Compose profile runs payment with `NODE_ENV=development`, as it does identity for the Auth emulator. `PaymentOutcomeService.apply(tx, paymentId, outcome)` is the one place an outcome is applied (a conditional update from `PENDING`, one outbox row), called by `fake-confirm` and by the Stripe webhook alike, so everything after a successful payment is exercised by the fake exactly as by Stripe.

---

## 7. Observability

- **Logs:** **pino** via `nestjs-pino`, JSON, one line per request with `requestId`. The gateway creates `x-request-id` (or accepts the web server's), passes it as gRPC metadata, the outbox stores it, and the relay copies it into NATS headers — so one id follows an order from click to webhook to status event. **Never log** a password, a token, a hash, a Stripe key, a webhook body or a full card-related payload.
- **Health:** `/health` (the process is up) and `/health/ready` (its own database, Redis, NATS — never a gRPC peer) on every service; Compose healthchecks use them.
- *(P2)* OpenTelemetry traces to a local Jaeger. Not before the request id stops being enough.

---

## 8. Testing

📌 [ADR 0024](./decisions/0024-vitest-is-the-only-test-runner.md). Vitest everywhere, transforming with SWC (`unplugin-swc`, decorator metadata on — without it Nest DI resolves `undefined`).

| Level | Database | Covers |
| :---- | :---- | :---- |
| **Unit** | none | pure rules (`assertTransition`, pricing, promotions, loyalty); services with `PrismaService` mocked |
| **Integration** | the service's `_test` database, the test broker | real SQL, constraints, transactions, the outbox row, **the three graded Task 10 proofs** |
| **Contract** | `_test` | one real gRPC round trip per RPC |
| **Gateway e2e** | none — gRPC peers, Redis and the event source stubbed | auth markers, validation, envelope, error mapping, the webhook's raw body |
| **Gateway integration** | Redis database 14, the test broker | real rate limiting, the SSE source's ordered consumer |
| **Web e2e** *(P1)* | Compose stack, fake payment provider | J1 with Playwright |
| **Latency** (`pnpm perf`) | the `apps` stack, seeded, `PAYMENT_PROVIDER=fake` | p95 of every P0 route < 500 ms — autocannon, **by hand, never in CI**. It stays under the rate limits instead of disabling them: a distinct `X-Forwarded-For` per request for IP-keyed classes (the gateway trusts one hop), user-keyed classes paced below their limit |

**The Task 10 proofs** (product-overview F10), each its own integration test, named for what it proves:

1. `refuses an ILLEGAL transition` — every pair not in the table of product-overview §6.4, table-driven.
2. `creates ONE order for two requests with the same Idempotency-Key` — sequential and concurrent; plus the same for payments.
3. `never oversells under CONCURRENT orders` — N parallel orders for stock K < N: exactly K succeed, stock ends at 0, never negative.

- Integration tests migrate the `_test` database once, then truncate between specs. They never touch the working database or the development broker.
- Stripe is never called in CI. Webhook handling is tested with events signed by the SDK against a local test secret — the real verification code runs.

---

## 9. CI/CD

**`pr.yml`** — every pull request, must be green to merge:

1. `pnpm install --frozen-lockfile`
2. `turbo run lint typecheck test` (affected packages)
3. `pnpm lint:md` and the repo guard specs
4. Integration tests against the project's own Compose stack (`docker compose up -d --wait`) — the same file as local, not separate CI service containers
5. `turbo run build`
6. OpenAPI, the Orval client (`pnpm --filter @brewlite/api-client generate`) and `buf generate` drift checks — regenerate, fail on a non-empty diff
7. Prisma migration drift check per service

**Practices:** trunk-based, short branches, one review required, Conventional Commits.

**Deployment:** the course requires the whole system to run from `docker compose` — the `apps` profile builds `web` and the five services from `Dockerfile.web` and `Dockerfile.service` (`ARG SERVICE`) and runs them beside the infrastructure. Identity and the gateway get their `JWT_*` keys through `env_file: [{ path: services/<svc>/.env, required: false }]`, reading whatever `pnpm keys:dev` already wrote — never written into `compose.yaml` itself. The runtime stage is `pnpm --filter @brewlite/<svc> --prod deploy --legacy` (pnpm 10 refuses a non-injected workspace without `--legacy`) and **never migrates** — `pnpm db:setup` on the host or in CI does. ⚠️ `.dockerignore` excludes `services/*/generated` (the Prisma client, rebuilt in the image) but **not** `packages/contracts/src/generated` (committed gRPC code the build needs). ⚠️ Every package reached only through a `tsconfig` `extends` (`packages/config`) is a declared `workspace:*` devDependency, or `turbo prune --docker` leaves it out of the build context. A cloud deployment is P2 and out of this document's scope.

---

## 10. Environment variables

Every Nest service declares its variables in `src/config/env.schema.ts` (zod), loaded once at boot through `@nestjs/config`; a missing or malformed value stops the process before it listens. Every app ships `.env.example` with every key and no secret value. A new variable is added to the schema, the example and this table in the same PR.

| Variable | Used by | Notes |
| :---- | :---- | :---- |
| `NODE_ENV` | all | `development`, `test` or `production` |
| `LOG_LEVEL` | all services | pino level, `info` by default |
| `DATABASE_URL` | identity, catalog, ordering, payment | `postgresql://…@localhost:25432/brewlite_<svc>` |
| `DATABASE_URL_TEST` | same | same server, `brewlite_<svc>_test` |
| `DATABASE_URL_SHADOW` | same | `brewlite_<svc>_shadow`, drift check only |
| `PRISMA_DB` | Prisma CLI only | `working` (default) or `test` |
| `REDIS_URL` | gateway, identity, catalog, ordering, payment | `redis://localhost:26379/0` |
| `REDIS_URL_TEST` | catalog | `redis://localhost:26379/15` — database 15 of the same server, so integration tests never touch the development cache |
| `REDIS_URL_TEST` | gateway | `redis://localhost:26379/14` — its own database, so the gateway's e2e specs (the `RateLimitGuard`'s keys) never touch the development bucket **or** catalog's database 15, and the two suites can run in parallel under Turborepo |
| `NATS_URL` | gateway, catalog, ordering, payment | `nats://localhost:24222` |
| `NATS_URL_TEST` | catalog, ordering, payment, gateway | `nats://localhost:24223` — integration tests never publish to the development broker |
| `GRPC_URL` | identity, catalog, ordering, payment | own bind address, e.g. `0.0.0.0:25052` |
| `OPS_PORT` | identity, catalog, ordering, payment | `/health*` and `/version` |
| `GIT_SHA`, `BUILT_AT` | all services | optional, shown by `/version`; Docker build arguments, `unknown` when unset |
| `IDENTITY_GRPC_URL`, `CATALOG_GRPC_URL`, `ORDERING_GRPC_URL`, `PAYMENT_GRPC_URL` | gateway; `CATALOG_GRPC_URL` also ordering; `ORDERING_GRPC_URL` also catalog (the orphan sweep's `GetOrderStatus`) and payment | peer addresses |
| `PORT` | gateway | `23100` |
| `GLOBAL_PREFIX` | gateway | `api`; never hard-coded elsewhere |
| `SWAGGER_ENABLED` | gateway | `false` in production |
| `TRUST_PROXY_HOPS` | gateway | exact proxy count in front of the gateway; `1` locally — the web server is one (api-endpoints-plan §0.1) |
| `JWT_PUBLIC_KEY` | gateway | ES256 public key, base64 PEM; empty in `.env.example` — `pnpm keys:dev` generates a matching pair and writes this to the gateway's `.env`, never committed |
| `JWT_PRIVATE_KEY` | identity | ES256 private key, base64 PEM — identity only; empty in `.env.example`; `pnpm keys:dev` writes this to identity's `.env` |
| `JWT_KEY_ID` | identity | `kid` in every token header; written by `pnpm keys:dev` alongside `JWT_PRIVATE_KEY` |
| `FIREBASE_PROJECT_ID` | identity, catalog | a `demo-brewlite` project id locally (emulator-only, no real project needed) |
| `GOOGLE_APPLICATION_CREDENTIALS` | identity, catalog | service-account key path when talking to a real Firebase project; unset with the emulators |
| `FIREBASE_AUTH_EMULATOR_HOST` | identity | `localhost:29099` locally; **unset** against a real project — identity refuses to boot if this is set with `NODE_ENV=production`. The `apps` Compose profile runs identity alone with `NODE_ENV=development` so its local demo can still use the emulator |
| `FIREBASE_STORAGE_BUCKET` | catalog | `demo-brewlite.appspot.com` locally |
| `FIREBASE_STORAGE_EMULATOR_HOST` | catalog | `localhost:29199` locally; unset against a real project |
| `STORAGE_PUBLIC_BASE_URL` | catalog | `http://localhost:29199` locally, `https://firebasestorage.googleapis.com` for real |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | identity's `bootstrap:admin` script only | the first `ADMIN` outside development; set for the one run, then removed |
| `SEED_ACCOUNT_PASSWORD` | identity's `seed:dev` only | password of `admin@`, `staff@`, `customer@brewlite.test`; unset → not created. Never set in a deployed environment |
| `PAYMENT_PROVIDER` | payment | `stripe` or `fake`; `fake` refused when `NODE_ENV=production` |
| `STRIPE_SECRET_KEY` | payment | restricted `rk_test_…`; required when the provider is `stripe` |
| `STRIPE_WEBHOOK_SECRET` | payment | `whsec_…` from `stripe listen` locally |
| `WEB_URL` | payment | base of Stripe's `return_url` — `http://localhost:23000` |
| `API_URL` | web (server only) | `http://localhost:23100/api/v1` |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | web | Firebase web config — public by design |
| `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` | web | `http://localhost:29099` locally; unset for real |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | web | `pk_test_…` |
| `IMAGE_REMOTE_HOSTS` | web (build time) | hosts `next/image` may load from — `localhost:29199` locally |

⚠️ Anything prefixed `NEXT_PUBLIC_` is compiled into the browser bundle. A secret there is a secret on the internet.
