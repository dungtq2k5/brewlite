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
  - ⚠️ pnpm 10 skips dependency build scripts unless allowed. Set `strictDepBuilds: true` and list what may build (`@swc/core`, `prisma`, `@prisma/engines`, `esbuild`, `protobufjs`, `@bufbuild/buf`, `simple-git-hooks`, `@scarf/scarf`) so a skipped native build fails the install instead of failing at runtime. Both settings live in **`pnpm-workspace.yaml`**. ⚠️ `ignoredBuiltDependencies` only silences the prompt — under `strictDepBuilds` an unlisted package still fails the install, so a package is either allowed or the install fails.
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

📌 [ADR 0027](./decisions/0027-host-ports-sit-in-the-2xxxx-range.md). This machine runs other stacks (Wayfare on `1xxxx`, Synapsedesk on its own set), so every host port BrewLite publishes is in the **2xxxx** range and every container is named `brewlite-<name>`. Inside the Compose network everything keeps its default port (`postgres:5432`, `nats:4222`).

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
- Every call goes through `BaseGrpcClient` from `nest-common`: a **2 s deadline**, the caller context and `x-request-id` as metadata, and connection failures mapped to `UNAVAILABLE`.
- ⚠️ A stopped container does not refuse a connection; it stays silent until the deadline. A deadline on a channel that never connected is reported as `503 UPSTREAM_UNAVAILABLE`, not `504` — the peer is down, not slow.

### 2.3 Asynchronous events — NATS JetStream

📌 [ADR 0005](./decisions/0005-grpc-for-synchronous-calls-and-jetstream-for-events.md) · [ADR 0006](./decisions/0006-events-leave-through-a-transactional-outbox.md).

- **Every event goes through JetStream**, never core NATS: a consumer restart must not lose "this order was paid".
- **Every event leaves through a transactional outbox.** The service writes an `outbox_events` row in the same transaction as the state change; a relay publishes unpublished rows with `Nats-Msg-Id = outbox id`. A crash between commit and publish then delays an event instead of losing it.
- **Every consumer is idempotent by construction** — a conditional update (`WHERE status = 'PENDING'`) or a unique key (`UNIQUE (order_id, kind)`) makes a redelivery a no-op. No service needs a `processed_events` table; if a future consumer cannot be made idempotent this way, it adds one.
- Streams: `ORDERING` (`ordering.>`), `PAYMENT` (`payment.>`), `DLQ` (`dlq.>`). Event streams keep 7 days with a 2-minute duplicate window; `DLQ` keeps 30 days. Durable consumer names are `<service>-<subject with dots as dashes>`, max 10 deliveries, then a dead letter.
- The gateway's SSE fan-out is the one **non-durable** consumer: an ordered, ephemeral consumer per gateway process, new messages only. A missed frame costs latency, never data — the browser refetches on reconnect ([ADR 0022](./decisions/0022-order-updates-reach-browsers-as-server-sent-events.md)).

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
- **Orval** generates with the `fetch` client and a custom mutator (base URL, bearer token, `Idempotency-Key`), plus zod schemas the web app reuses for form validation. No TanStack Query hooks.
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

- **Rate limits** — `@nestjs/throttler` in the gateway with Redis storage, so limits hold across replicas. Classes in api-endpoints-plan §0.8.
- **Cache** — catalog caches the public menu (`catalog:menu`) and deletes the key after every menu write commits, and when a product's stock crosses zero. `MENU_CACHE_TTL_MS` is only the backstop. **The web app caches no API data**: one cache layer, one place to invalidate.
- **Background jobs** — **BullMQ** via `@nestjs/bullmq`, as repeatable jobs with stable ids (never `@Cron`, which fires once per replica):

| Job | Service | Every | Does |
| :---- | :---- | :---- | :---- |
| `orders-expire` | ordering | 1 min | cancels `PENDING` / `PAYMENT_FAILED` orders past `expires_at` |
| `reservations-release-orphans` | catalog | 15 min | releases `HELD` reservations older than `RESERVATION_ORPHAN_TTL_MS` |
| `outbox-prune` | ordering, payment | daily | deletes outbox rows published more than 7 days ago |
| `sessions-prune` | identity | daily | deletes expired sessions |

- A job is a plain method taking `now`, so a test calls it directly and never starts a worker.
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

- An admin uploads through the gateway (`multipart/form-data`, ≤ `PRODUCT_IMAGE_MAX_BYTES`); the gateway passes the bytes to catalog over gRPC; catalog **checks the magic bytes** (JPEG, PNG or WebP — never the extension or the declared type), writes `products/<productId>/<newId>.<ext>` with `firebase-admin`, stores the path, and deletes the previous image.
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

### 4.2 The web server is the BFF

```text
browser ──cookies──▶ Next.js server ──Bearer + X-Request-Id──▶ gateway ──gRPC──▶ services
                        │ proxy.ts: refresh the access token; send guests to sign in; gate /staff and /admin
                        │ Server Components: GET through the generated client
                        │ Server Actions: POST/PATCH/DELETE through the generated client
                        └ Route Handlers: /api/events/* — proxy the SSE streams
```

- Tokens live in **`httpOnly`, `SameSite=Lax`** cookies on the web origin — `bl_at` (access, 15 min) and `bl_rt` (refresh, 30 days), `Secure` outside development. **Browser JavaScript never sees a token.**
- The generated client runs **only on the server** (`import 'server-only'` in the mutator). `API_URL` is a server-only variable, never `NEXT_PUBLIC_`.
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
- **Caller context:** the gateway passes `x-user-id`, `x-user-role` and `x-request-id` to services as gRPC metadata. Services trust it — they are unreachable except through the gateway — and **every ownership check happens in the service**, scoped in the query (`WHERE id = $1 AND user_id = $2`).
- **HTTP hardening:** `helmet` on the gateway; strict CSP on the web app; `trust proxy` set to the exact hop count.
- **Secrets:** `.env` locally (git-ignored, with a committed `.env.example` per app), GitHub Actions secrets in CI. Never in source, never in logs. `NEXT_PUBLIC_*` is compiled into the browser bundle — public values only.

---

## 6. Payments — Stripe 🎓

📌 [ADR 0017](./decisions/0017-stripe-checkout-is-the-payment-surface.md) · [ADR 0002](./decisions/0002-every-amount-is-an-integer-number-of-dong.md).

- **API:** **Checkout Sessions**, `mode: 'payment'`, **embedded** UI. One line item — *BrewLite order #1042* — with `price_data` for the order's total in **VND**, so a discount can never disagree with Stripe's arithmetic. `client_reference_id` and `metadata` carry the payment id and order id. `expires_at` = now + `CHECKOUT_SESSION_TTL_MS`. 🔬 Confirm the exact `ui_mode` value for embedded Checkout and pass `integration_identifier` on the pinned API version.
- **VND is zero-decimal:** the Stripe `amount` is the đồng total as-is. Never multiply by 100.
- **Never pass `payment_method_types`.** Methods (card, Google Pay, Apple Pay, Link) are chosen in the Dashboard; Stripe shows what fits the device.
- **Server SDK:** `stripe` for Node — `new Stripe(key, { apiVersion })` with the version pinned in code (latest at writing: `2026-07-29.dahlia`). Never the global-key pattern.
- **Keys:** a **restricted** key (`rk_test_…`) with Checkout Sessions write, Refunds write and Events read — never a full `sk_`. Test mode only (product-overview §12).
- **Idempotency:** the `Idempotency-Key` of `POST /payments` is forwarded as Stripe's idempotency key on `checkout.sessions.create`; a refund uses its own row id.
- **Webhook:** `POST /api/webhooks/stripe` (version-neutral) on the gateway, forwarded with the **raw body** and the `Stripe-Signature` header to payment, which verifies the signature before anything else, inserts the event id (duplicate → acknowledged, nothing done), and applies it in one transaction with its outbox row. Handled events:

| Stripe event | Effect |
| :---- | :---- |
| `checkout.session.completed` with `payment_status` ≠ `unpaid` | payment `SUCCEEDED` → `payment.payment.succeeded` |
| `checkout.session.async_payment_succeeded` | same |
| `checkout.session.async_payment_failed` | payment `FAILED` → `payment.payment.failed` |
| `checkout.session.expired` | payment `EXPIRED` → `payment.payment.failed` (`reason: EXPIRED`) |
| `refund.updated` | refund `SUCCEEDED` / `FAILED` → `payment.refund.succeeded` / `payment.refund.failed` (🔬 confirm the event name when wiring) |

- ⚠️ Nest parses JSON bodies by default; signature verification needs the **raw body**. Create the gateway with `rawBody: true` and read `req.rawBody` on the webhook route.
- ⚠️ **Fulfil from the webhook, never from the return page.** A customer can pay and close the tab.
- **Local development:** `stripe listen --forward-to localhost:23100/api/webhooks/stripe` — its printed `whsec_…` goes into payment's `STRIPE_WEBHOOK_SECRET`. No Stripe account yet? `stripe sandbox create`.
- **Fake provider:** `PAYMENT_PROVIDER=fake` swaps Stripe for an in-process provider behind the same `PaymentProvider` interface. `fake-confirm` produces exactly the events the webhook would. Refused in production.

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
| **Gateway e2e** | none (gRPC peers stubbed) | auth markers, validation, envelope, error mapping, the webhook's raw body |
| **Web e2e** *(P1)* | Compose stack, fake payment provider | J1 with Playwright |

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
6. OpenAPI + Orval and `buf generate` drift checks — regenerate, fail on a non-empty diff
7. Prisma migration drift check per service

**Practices:** trunk-based, short branches, one review required, Conventional Commits.

**Deployment:** the course requires the whole system to run from `docker compose` — the `apps` profile builds `web` and the five services from `Dockerfile.web` and `Dockerfile.service` (`ARG SERVICE`) and runs them beside the infrastructure. The runtime stage is `pnpm --filter @brewlite/<svc> --prod deploy --legacy` (pnpm 10 refuses a non-injected workspace without `--legacy`) and **never migrates** — `pnpm db:setup` on the host or in CI does. ⚠️ `.dockerignore` excludes `services/*/generated` (the Prisma client, rebuilt in the image) but **not** `packages/contracts/src/generated` (committed gRPC code the build needs). ⚠️ Every package reached only through a `tsconfig` `extends` (`packages/config`) is a declared `workspace:*` devDependency, or `turbo prune --docker` leaves it out of the build context. A cloud deployment is P2 and out of this document's scope.

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
| `REDIS_URL` | gateway, identity, catalog, ordering, payment | `redis://localhost:26379` |
| `NATS_URL` | gateway, catalog, ordering, payment | `nats://localhost:24222` |
| `NATS_URL_TEST` | catalog, ordering, payment | `nats://localhost:24223` — integration tests never publish to the development broker |
| `GRPC_URL` | identity, catalog, ordering, payment | own bind address, e.g. `0.0.0.0:25052` |
| `OPS_PORT` | identity, catalog, ordering, payment | `/health*` and `/version` |
| `GIT_SHA`, `BUILT_AT` | all services | optional, shown by `/version`; Docker build arguments, `unknown` when unset |
| `IDENTITY_GRPC_URL`, `CATALOG_GRPC_URL`, `ORDERING_GRPC_URL`, `PAYMENT_GRPC_URL` | gateway; `CATALOG_GRPC_URL` also ordering; `ORDERING_GRPC_URL` also payment | peer addresses |
| `PORT` | gateway | `23100` |
| `GLOBAL_PREFIX` | gateway | `api`; never hard-coded elsewhere |
| `SWAGGER_ENABLED` | gateway | `false` in production |
| `TRUST_PROXY_HOPS` | gateway | exact proxy count in front of the gateway; `1` locally — the web server is one (api-endpoints-plan §0.1) |
| `JWT_PUBLIC_KEY` | gateway | ES256 public key, base64 PEM |
| `JWT_PRIVATE_KEY` | identity | ES256 private key, base64 PEM — identity only; `pnpm keys:dev` generates a local pair |
| `JWT_KEY_ID` | identity | `kid` in every token header |
| `FIREBASE_PROJECT_ID` | identity, catalog | a `demo-brewlite` project id locally (emulator-only, no real project needed) |
| `GOOGLE_APPLICATION_CREDENTIALS` | identity, catalog | service-account key path when talking to a real Firebase project; unset with the emulators |
| `FIREBASE_AUTH_EMULATOR_HOST` | identity | `localhost:29099` locally; **unset** against a real project |
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
