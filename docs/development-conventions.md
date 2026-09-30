# Development Conventions — BrewLite

**Audience:** every developer writing code in this repository.

**Scope:** rules and examples only. *What* the system is lives in [`product-overview.md`](./product-overview.md) and [`architecture-and-tech-stack.md`](./architecture-and-tech-stack.md); *what* the data and API look like lives in [`rdm-spec.md`](./rdm-spec.md) and [`api-endpoints-plan.md`](./api-endpoints-plan.md); *why* lives in [`decisions/`](./decisions/). Where a rule has a reason worth more than a line, it links the ADR instead of arguing.

Read §1 and §2 before your first commit. Use §18 as the pre-PR checklist.

- **MUST / MUST NOT** — a reviewer blocks the PR.
- **SHOULD** — deviate only with a comment saying why.
- **MAY** — genuine discretion.

Most rules here exist because breaking them fails **silently** — a wrong total stored, an event lost, a cup sold twice. Loud failures do not need conventions; the compiler and the tests catch those.

---

## 1. The golden rules

1. **The user comes from the token, never from input.** No route accepts a `userId` or a role in a path, body or query. (§4)
2. **Someone else's resource is `404`, never `403`**, and the query is scoped by the caller — not fetched, then compared. (§4.2)
3. **The server prices every order.** An amount sent by a client is never read. (§10.1)
4. **Money is an integer number of đồng in a `…Vnd` / `…_vnd` field**, in every layer. Never a float, never × 100. (§10.1)
5. **An order's status changes only through `assertTransition` and a conditional update.** (§7.5)
6. **Stock changes only under the version lock.** (§7.6)
7. **Every event is written to the outbox inside the transaction that caused it.** Never publish from a request path. (§8.1)
8. **Every consumer survives the same event twice** — by a conditional update or a unique key. (§8.2)
9. **No `enum` block in any `schema.prisma`.** Enumerated columns are strings; the values live in `packages/contracts`. (§7.4)
10. **Payments are fulfilled from the webhook, never from the return page; never pass `payment_method_types`.** (§10.2)
11. **Servers send codes; the web app renders words** — through i18next, in English and Vietnamese. No user-facing sentence is built on a server, and none is hard-coded in a component. (§6.1, §11.6)
12. **Tokens never reach browser JavaScript.** The generated API client runs on the Next.js server only. (§11.1)
13. **A row others cite is soft-deleted, never `DELETE`d** — `deleted_at` + `deleted_by_id`, and every read filters it. (§7.3)
14. **A guest never reaches an order, a payment or points.** Those routes are `USER`; only the menu and sign-in are `PUBLIC`. (§11.7)
15. **Production is silent.** No stack traces, no internal messages, no permission names past the gateway. (§13.3)

---

## 2. Architecture and layering

### 2.1 A domain service module: controller → service → Prisma

[ADR 0008](./decisions/0008-services-query-prisma-7-directly.md). There is **no repository layer**.

```text
services/ordering/src/modules/orders/
├── orders.module.ts
├── orders-grpc.controller.ts      PRESENTATION — implements the generated OrderServiceController
├── payment-events.consumer.ts     PRESENTATION — JetStream consumer: validate payload, delegate once
├── orders.service.ts              BUSINESS + DATA — use cases, transactions, Prisma, outbox; returns proto
├── order.mapper.ts                Prisma select shapes + row → proto, field by field
├── orders-expire.job.ts           scheduled job: a plain method taking `now`
└── domain/
    ├── order-lifecycle.ts         ORDER_TRANSITIONS, assertTransition — no Nest, no Prisma
    └── promotion.ts               applyPromotion, validatePromotion — pure
```

- A **gRPC controller** is `@Controller()` with the generated `@<Name>ServiceControllerMethods()` decorator and `implements <Name>ServiceController`, so a method missing from the proto is a compile error. Each method reads the caller with `callerFrom(metadata)` and returns `this.service.x(request, caller)`. **No Prisma, no mapping, no branching.** A consumer does the same for an event payload.
- A **service** is the only file that runs Prisma queries for its module. It takes the proto request and the caller, returns the proto response built by the mapper, and throws only `rpcError()` (§5.3) — **never** an HTTP exception.
- A **mapper** owns the `select` shapes (`ORDER_DETAIL_SELECT`), their row types (`OrderDetailRow`) and the row → proto functions. It imports Prisma **types only**, lists every output field explicitly — never `const { passwordHash, ...rest } = row` — and never queries anything.
- **A rule with no I/O is a pure function in `domain/`**, importing nothing from `@nestjs/*` or the Prisma client — not even `import type` (the `module-files` guard refuses it) — unit-tested without Nest. Every Task 10 rule is one: the state machine, the promotion arithmetic, loyalty earning. When the web app needs the same rule (unit pricing), it lives in `packages/contracts` instead.
- A `lock…(tx, …)` method that takes a row lock is I/O: it lives on the owning service, never in `domain/`.
- **One module never queries another module's tables.** It calls that module's service.
- Enforced by `eslint` `no-restricted-imports`: the runtime Prisma client only in `*.service.ts`, `prisma.service.ts` and `prisma/seed/**`; controllers and consumers may not import it.

**Transactions are opened in the service.** A helper that takes part in one accepts `tx: Prisma.TransactionClient` as its first parameter and **MUST NOT** use `this.prisma` — mixing the two silently runs part of the work outside the transaction:

```ts
// orders.service.ts
async markPaid(event: PaymentSucceeded): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    const order = await this.transition(tx, event.orderId, ['PENDING', 'PAYMENT_FAILED'], 'PAID', PAYMENT_ACTOR);
    if (!order) return this.rejectLatePayment(tx, event); // not payable any more → refund path
    await this.loyalty.earn(tx, order);
    await this.outbox.add(tx, OrderingEvents.statusChanged(order, 'PAID'));
  });
}
```

### 2.2 The gateway: controller → service → gRPC client + mapper

The gateway has no business logic and no database.

```text
services/gateway/src/modules/orders/
├── orders.module.ts
├── orders.controller.ts            routes: auth marker, validation, OpenAPI decorators
├── orders.service.ts               calls the gRPC client; maps proto → response DTO
├── ordering-service-grpc.client.ts extends BaseGrpcClient; returns proto types only
├── order.mapper.ts                 proto ⇄ DTO
└── dto/
    ├── order.dto.ts                request schemas (zod → createZodDto)
    └── order-response.dto.ts       response schemas — what OpenAPI and Orval see
```

| Layer | Returns | May import |
| :---- | :---- | :---- |
| `*.controller.ts` | whatever its service returned | its service — never a client, never a mapper |
| `*.service.ts` | a response DTO | the client and the mapper |
| `*.mapper.ts` | a DTO or a proto request | proto types, DTOs, `packages/contracts` |
| `*-grpc.client.ts` | the generated proto message | generated proto types only |

- A one-line pass-through gateway service is expected; it is where the first composition lands instead of a controller.
- The gateway **MUST NOT** return a proto message as a response.
- **Route order matters:** a controller declaring `/orders/me` is registered before one declaring `/orders/:id`, or `me` reaches the UUIDv7 validator.

### 2.3 Where a new file goes

| You are adding… | Put it in |
| :---- | :---- |
| A value shared by two services, or a service and the web app (an enum, a limit, an error code, a permission) | `packages/contracts/src/<topic>.ts` |
| A pricing rule the web app also runs | `packages/contracts/src/pricing/` |
| A JetStream subject and its payload schema | `packages/contracts/src/events/<publisher>.events.ts` |
| A `.proto` | `packages/contracts/proto/brewlite/<service>/<name>.proto` |
| A pure rule used by one service | `services/<svc>/src/modules/<mod>/domain/` |
| A Nest guard, interceptor, decorator or base class shared by services | `packages/nest-common/src/<kind>/` |
| A provider adapter (the one file that imports Stripe or `firebase-admin`) | `services/<svc>/src/providers/<kind>/<vendor>.<kind>-provider.ts` |
| SQL Prisma cannot express | `services/<svc>/prisma/sql/schema-objects.sql` |
| A seed | `services/<svc>/prisma/seed/<scope>.seed.ts` |
| A page | `apps/web/src/app/<group>/…/page.tsx` |
| A Server Action | `apps/web/src/app/<group>/…/actions.ts`, beside the page that uses it |

---

## 3. Shared packages

### 3.1 Search before you write

Before writing a helper, **MUST** search `packages/`. Ids, money arithmetic, unit pricing, hashing (including `contentHash`, a canonical-JSON SHA-256 for idempotency keys), email normalisation and the business day already exist; a second implementation disagrees with the first on the one input where it matters.

Import by package name, **never** by a relative path across a package or service boundary:

```ts
// ✓
import { newId, computeUnitPrice, OrderStatus } from '@brewlite/contracts';
// ✗
import { computeUnitPrice } from '../../../../packages/contracts/src/pricing';
```

A shared addition needs a **second consumer** that exists or is imminent. One consumer ⇒ keep it local.

### 3.2 `packages/contracts` is client-safe

The web app imports it, so it **MUST NOT** import `node:*` or any Node-only package. Anything needing `node:crypto` (`contentHash`, `hashToken`, `generateToken`) lives in `packages/nest-common`.

- An enumerated domain value is a TypeScript `enum` plus a derived `readonly` array for validation:

  ```ts
  export enum OrderStatus {
    PENDING = 'PENDING', PAYMENT_FAILED = 'PAYMENT_FAILED', PAID = 'PAID', PREPARING = 'PREPARING',
    READY = 'READY', COMPLETED = 'COMPLETED', CANCELLED = 'CANCELLED',
  }
  export const ORDER_STATUSES = Object.values(OrderStatus);
  ```

- Every enumerated **column** has its enum in `enums.ts`; enums that exist only inside an error's `details` (`ResourceKind`, `PromoInvalidReason`, …) live in `error-details.ts`. The order's refund view and the refund row are different enums, `OrderRefundStatus` and `RefundStatus`. A subset is derived from the enum (`STAFF_BOARD_STATUSES`), never retyped.
- A literal map used as keys (event subjects, SSE event names, rate-limit classes) is `as const` plus a derived union.
- **Every limit the edge validates and the database bounds is one constant** — `ORDER_NOTE_MAX_LENGTH`, `MAX_QTY_PER_LINE` — imported by the zod schema and named in the rdm-spec column. Never a `200` typed twice.
- **A field typed `string` where a union exists is a bug.** Narrow at the boundary by parsing (zod, `parseEnum`), never by casting.
- Sort machine strings with `compareStrings` (code-unit order, same as Postgres `COLLATE "C"`), never `localeCompare`. A bare `sort()` is a lint error.

---

## 4. Identity and request scoping

### 4.1 Reading the caller

The gateway verifies the access token once, before any guard, and builds a `RequestContext`. Handlers take it by decorator; the route's auth marker (§6.3) guarantees which variant arrives:

```ts
@Get('me')
@Auth('USER')
listMine(@Ctx() ctx: UserContext, @Query() q: ListMyOrdersQuery) { … }

@Post(':id/status')
@RequirePermission('order.status.update')
advance(@Ctx() ctx: UserContext, @Param() p: OrderIdParam, @Body() body: AdvanceOrderBody) { … }
```

`RequestContext` is `AnonymousContext` (`requestId`, `ip`) or `UserContext` (+ `userId`, `role`, `sessionId`, `permissions`). **MUST NOT** cast one to the other; narrow with `isUserContext`.

Services receive the caller as gRPC metadata (`x-user-id`, `x-user-role`, `x-request-id`), rebuilt by `callerFrom(metadata)`. A job or consumer with no request uses the frozen `SYSTEM_CALLER`.

### 4.2 Ownership

Every `USER` route that addresses a resource **MUST** scope the query by the caller:

```ts
// ✓ one query; another customer's id is simply not found
const order = await this.prisma.order.findFirst({
  where: { id: request.orderId, userId: caller.userId },
  select: ORDER_DETAIL_SELECT,
});
if (!order) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'ORDER' });

// ✗ leaks existence with a 403, and a forgotten comparison is a data leak
const order = await this.prisma.order.findUnique({ where: { id: request.orderId } });
if (order.userId !== caller.userId) throw rpcError('PERMISSION_DENIED', { required: [] });
```

**Not found and not yours are the same answer: `404`.**

---

## 5. gRPC

### 5.1 Contract first

`.proto` files live in `packages/contracts/proto/brewlite/<service>/`, `package brewlite.<service>;`. Change the proto → `pnpm proto:generate` → fix both ends. **Never hand-edit generated code.** `buf lint` runs in CI.

- Every RPC has its own `…Request` / `…Response` message, even when two would be identical.
- A domain enum crosses gRPC as a plain `string` field, not a proto `enum` — a `stringEnums` proto enum arrives as `'PRODUCT_SIZE_M'`, not the contracts value `'M'`, so every enum would need a bridge table both ways. The receiver parses it with `parseEnum(Enum, value)`, which refuses anything unknown.
- `int64` fields (`order_no`) are strings in TypeScript; the mapper converts with a safe-integer check.
- Protobuf has no `null`. The mapper converts `undefined` → `null` field by field, so response shapes stay stable.
- The loader runs with `oneofs: false`, or every `optional` field arrives with a synthetic `_field` key. Its options are **one constant**, `PROTO_LOADER_OPTIONS` in `nest-common`, shared by server and client — `longs: String` pairs with ts-proto's `forceLong=string`, `enums: String` with `stringEnums`. A mismatch compiles and then compares a number with a string at runtime.

### 5.2 Calling a peer

Every call goes through `BaseGrpcClient.call()` from `nest-common` — clients `extend BaseGrpcClient` — which applies the **2 s deadline** (override per call, never remove), attaches the caller and `x-request-id` as metadata, and maps a channel that never connected to `UNAVAILABLE` rather than `DEADLINE_EXCEEDED`. **MUST NOT** call a generated stub directly.

**Batch RPCs map results by the requested keys, never by response order:**

```ts
// ✓
const byId = new Map(res.products.map((p) => [p.id, p]));
return ids.map((id) => byId.get(id) ?? null);
```

### 5.3 Errors across the boundary

A service throws only through `rpcError(code, details?)`. `ERRORS[code]` in `packages/contracts` holds the gRPC status, the HTTP status and the `details` schema, so a code can never travel with two statuses. Only the code crosses the wire — trailing metadata `bl-error-code`, plus `bl-error-details-bin` (UTF-8 JSON) when there are details — and the gateway looks the HTTP status up in the same registry. `rpcError` is typed by the code — a code with a `details` schema requires details, one without refuses them — and parses the details at the call, so a wrong shape fails where it was built:

```ts
throw rpcError('OUT_OF_STOCK', { products: [{ productId, available: 0 }] });
throw rpcError('INVALID_STATE', { status: current });
```

| gRPC status | HTTP | Use for |
| :---- | :---- | :---- |
| `INVALID_ARGUMENT` | 400 | bad input the edge could not catch |
| `UNAUTHENTICATED` | 401 | bad credentials |
| `PERMISSION_DENIED` | 403 | not allowed |
| `NOT_FOUND` | 404 | missing — **and** not the caller's |
| `ALREADY_EXISTS` | 409 | uniqueness |
| `FAILED_PRECONDITION` | 409, or 422 for a business-rule refusal — per code in `ERRORS` | illegal transition, stale version, out of stock, invalid promo |
| `RESOURCE_EXHAUSTED` | 429 | rate limit |
| `UNAVAILABLE` | 503 | a peer or provider is down |
| `DEADLINE_EXCEEDED` | 504 | a peer is too slow |

**MUST NOT** `throw new RpcException({ … })` by hand. An error the gateway receives **without** a code is `503 UPSTREAM_UNAVAILABLE` for `UNAVAILABLE`, `504 UPSTREAM_TIMEOUT` for `DEADLINE_EXCEEDED`, otherwise `500 INTERNAL`, logged as a bug.

---

## 6. REST (gateway)

### 6.1 Response and error shapes

As defined in api-endpoints-plan §0.3. A global interceptor wraps success as `{ data, meta? }`; a global filter builds `{ error: { code, message, details?, requestId } }`.

- Handlers return raw data, or `Paged.cursor(items, next)` / `Paged.page(items, meta)` (`packages/nest-common`) — an offset query is built with `zPageQuery(sortFields, defaultSort?)` (`packages/contracts`), which bounds `page`/`pageSize` and allowlists `sort` (each field, plus `-field` for descending); a cursor query is built with `zCursorQuery` (`cursor?: base64url ≤ 64 chars`, `limit`), for endpoints ordered by id rather than sorted, like `GET /orders/me`. Returning `{ data }` yourself double-wraps.
- Every thrown error carries an `ErrorCode`. A new code is added to `ERRORS`, to api-endpoints-plan §7, and to the web app's `errors` namespace **in both locales** in the same PR.
- **MUST NOT** put a user-facing sentence in `message`. It is English, for developers.
- `@SkipEnvelope()` is for ops routes and the SSE streams only.

### 6.2 DTOs and validation

[ADR 0011](./decisions/0011-zod-is-the-only-schema-language-and-orval-generates-the-client.md).

- Request and response shapes are **zod schemas** made into DTOs with `createZodDto`, so OpenAPI comes from the definition that validates.
- **Requests are `.strict()`** — an unknown key is `400`, so a client sending `totalVnd` learns at once that it is ignored.
- Responses are validated in development and test, and stripped to the schema in production so a mapper cannot leak a column.
- Query and path values arrive as strings: `z.coerce.number()`, the shared `zBooleanParam` — never `Boolean(value)`, which reads `"false"` as `true`.
- **Nullable and optional are different.** A response field is `.nullable()` (key always present), never `.optional()`. A request field is `.optional()` only when absence means "leave unchanged". A PATCH schema **MUST NOT** default a field — the default would overwrite the stored value on every unrelated update.
- Every id from outside is parsed with `zUuidV7`, including `Idempotency-Key`.
- **Import `nestjs-zod` only through `@brewlite/nest-common`**, which re-exports it. pnpm can install two physical copies across workspace packages, and then `instanceof ZodValidationException` is silently `false` and validation errors become `500`s.
- User-entered text is NFC-normalised by `normalizeText()` before validation.

### 6.3 Auth markers and guards

**Every route declares exactly one rule:** `@Auth('PUBLIC' | 'USER' | 'SIGNATURE')` or `@RequirePermission(code)`. A route with none, or two, **stops the gateway from booting** — a forgotten guard is the failure that actually happens, and it fails open. The marker also applies the route's Swagger security scheme.

- `@Auth`, `@RequirePermission` and `@RateLimit` live in `packages/nest-common` (`http/access.decorators.ts`), not the gateway — `OpsController`, also in nest-common, needs them for its own routes. The guards that read them (`AuthGuard`, `PermissionGuard`, `RateLimitGuard`) are the gateway's own, under `src/auth/`.
- Guards run in order: `AuthGuard` → `PermissionGuard` → `RateLimitGuard`.
- `@RequirePermission()` with no code is a compile error.
- Every route has one rate-limit class (api-endpoints-plan §0.8), from `@RateLimit(class | 'NONE')` or the marker's default.
- A gateway guard runs before any gRPC call, so it cannot build an `RpcException` — it throws `apiError()` instead, the guard-side twin of `rpcError()` (§5.3).

### 6.4 Idempotent routes

A route marked ⟳ declares `@RequireIdempotencyKey()`, which refuses a request without a valid UUIDv7 key (`400`) and passes it to the service as a field of the gRPC request. **The gateway stores nothing** — the service's unique index is the guarantee ([ADR 0020](./decisions/0020-idempotency-keys-are-enforced-by-a-unique-constraint.md)).

### 6.5 Prefix, versioning and OpenAPI

`main.ts` is the only place the prefix and versioning are configured:

```ts
app.setGlobalPrefix(config.get('GLOBAL_PREFIX', { infer: true }), {
  exclude: ['health', 'health/ready', 'version'],
});
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
```

- **MUST NOT** write `api` or `v1` in a `@Controller()` path, a client base URL or a test URL.
- A breaking change adds `@Version('2')` to that route only.
- The Stripe webhook is `@Controller({ path: 'webhooks/stripe', version: VERSION_NEUTRAL })` and `@ApiExcludeController()`.
- Every route declares its response with `@ApiEnvelope(Dto, { status?, list? })` and the error codes only it can return with `@ApiErrors(…)`. An undeclared response is an untyped client; an undeclared error code is a web page that says "Something went wrong" for a condition it could have explained.

---

## 7. Prisma and data

### 7.1 Schema changes

- **Development:** edit `schema.prisma`, `pnpm db:migrate:dev --name <what>`, then `pnpm db:objects`. Commit the migration.
- `pnpm db:deploy` is a service's whole database deployment: `prisma migrate deploy`, then `db:objects`, then the system seed. `pnpm db:setup` runs it on the working **and** `_test` databases.
- **A committed migration is never edited.** A mistake is fixed by the next migration.
- Adding a `NOT NULL` column to a table with rows is: add nullable → backfill → set `NOT NULL`, in separate migrations.
- A schema change **MUST** update rdm-spec in the same PR — column, type, nullability, default, and **the full value list** of any enumerated column.
- **Development seeds** (`pnpm seed:dev`) are idempotent — a second run writes nothing — refuse to run when `NODE_ENV=production`, and write through the service's own methods, so events and hashes are real.

### 7.2 Naming in the schema

```prisma
model OrderItem {
  id           String @id @default(uuid(7)) @db.Uuid
  orderId      String @map("order_id") @db.Uuid
  size         String @db.VarChar(1)          /// ProductSize in @brewlite/contracts
  unitPriceVnd Int    @map("unit_price_vnd")
  qty          Int    @db.SmallInt

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@map("order_items")
}
```

- Model `PascalCase` singular; field `camelCase`; physical `snake_case` via `@map` / `@@map`, tables plural.
- **Every** column declares its native type (`@db.VarChar(n)`, `@db.Timestamptz(3)`, `@db.Uuid`). Prisma's defaults (`text`, `timestamp(3)` without zone) are wrong here.
- Ids are `@default(uuid(7)) @db.Uuid` — never `uuid()`, `cuid()` or a database default. A raw insert supplies `newId()`.
- An enumerated column carries a `///` comment naming its `packages/contracts` type. A `///` line **MUST NOT** begin with `@`.

### 7.3 Soft delete and locks

[ADR 0030](./decisions/0030-rows-others-cite-are-soft-deleted-and-accounts-are-locked-or-deactivated.md). Soft-deletable tables: `users`, `categories`, `products`, `toppings`, `promotions` (rdm-spec §1.8, column shapes §2.9).

- **Every read filters `deletedAt: null`**, through the shared `live()` where-clause, unless the method is an admin read that says so in its name (`findByIdIncludingDeleted`, `listDeleted`). A forgotten filter puts a deleted product back on the menu — silently.
- Deleting sets `deletedAt` **and** `deletedById` (from the caller, never input) in one write; restoring clears both. **MUST NOT** call `delete()` / `deleteMany()` on these models — a lint rule refuses it outside tests.
- A restore that would clash with a live unique value catches `P2002` and answers the entity's `…_NAME_TAKEN` code.
- **A lock is three columns that move together** — `isLocked`, `lockedUntil`, `lockReason` — set together by `lock()` and cleared together by `unlock()`; a `CHECK` refuses a half-written lock. An expired lock is lifted **lazily and conditionally** in the sign-in and refresh paths (rdm-spec §2.9), never by a job.
- `lockReason` **MUST NOT** appear in any response to the locked user or in an error `details` — only in admin responses.

### 7.4 Enumerated columns

[ADR 0010](./decisions/0010-enumerated-columns-are-strings-not-prisma-enums.md).

```prisma
// ✗ NEVER
enum OrderStatus { PENDING PAID }
// ✓ ALWAYS
status String @db.VarChar(16)   /// OrderStatus in @brewlite/contracts
```

Because the database does not enforce the set (except where a `CHECK` backs it, rdm-spec §5), the code **MUST** validate at every write, and map a stored string to the enum **once**, with `parseEnum(OrderStatus, row.status)`, which throws on an unknown value.

### 7.5 State transitions

[ADR 0019](./decisions/0019-order-status-changes-only-through-the-state-machine.md). Every status write:

1. checks `assertTransition(from, to)` against `ORDER_TRANSITIONS` — the table in product-overview §6.4, and nowhere else;
2. is a **conditional update** — `updateMany({ where: { id, status: from }, data: { status: to, … } })` — and treats `count === 0` as `409 INVALID_STATE` with the current status;
3. inserts the `order_status_history` row and the outbox event **in the same transaction**.

**MUST NOT** read the status, decide in JavaScript, then write with `update({ where: { id } })` — two taps or a webhook racing the expiry job then both succeed.

### 7.6 Optimistic locking on stock

[ADR 0018](./decisions/0018-stock-is-reserved-at-order-creation-under-optimistic-locking.md).

```ts
// catalog stock.service.ts — inside the reservation transaction, per merged line
const { count } = await tx.product.updateMany({
  where: { id: line.productId, version: read.version, stockQty: { gte: line.qty } },
  data: { stockQty: { decrement: line.qty }, version: { increment: 1 } },
});
if (count === 0) { /* re-read: short → OUT_OF_STOCK; else retry, max STOCK_RESERVE_MAX_RETRIES */ }
```

- **Every** write to `stock_qty` bumps `version` — reservation, release and staff edits alike.
- Lines of the same product are merged before reserving, and products are reserved in `compareStrings` order of id, so two orders never lock-step each other into retries.

### 7.7 Uniqueness

- A rule that is "unique among live rows" is a **partial unique index** in `schema-objects.sql`, never `@unique`.
- **The index is the enforcement; the pre-check is the error message.** Every insert that can conflict catches `P2002` with `isUniqueConstraintViolation(error, target?)` (`packages/nest-common`) and maps it to its specific code (`PRODUCT_NAME_TAKEN`) — or, for an idempotency key, returns the existing row. `target` (a column name) narrows to one index, so a clash on a different column is never mistaken for the one being checked; it matches both the classic engine's `meta.target` array and the driver adapter's constraint-name shape.

### 7.8 Query hygiene

- `select` the columns you need. A `findMany` on `users` without `select` loads `password_hash`.
- Filter and sort in the database, never in JavaScript. **The one exception:** the cached public menu (architecture §2.6) — the cache holds the whole menu (bounded at `MAX_MENU_PRODUCTS`), and a `categoryId` filter is applied to the cached array, because filtering in SQL would mean a query, and therefore a cache, per category.
- A list query has a `take`. An unbounded `findMany` is a bug even when today's table is small.
- **Read back after a transaction, not inside it**, when the response needs several relations.
- A multi-row invariant that is not a single conditional update (a promotion's `max_uses` and per-customer limit) takes a **row lock** — `SELECT … FOR UPDATE` in a `lock…` method taking `tx` — before reading what it checks.
- **MUST NOT** use `$queryRawUnsafe` or build SQL by string concatenation. Raw SQL uses physical names and has an integration test.

---

## 8. Events, jobs and live updates

### 8.1 Publishing: always through the outbox

[ADR 0006](./decisions/0006-events-leave-through-a-transactional-outbox.md).

```ts
await this.prisma.$transaction(async (tx) => {
  const order = await this.transition(tx, id, ['PAID'], 'CANCELLED', staffActor);
  await this.outbox.add(tx, OrderingEvents.statusChanged(order, 'CANCELLED'));
});
```

- `outbox.add` validates the payload against the subject's zod schema **before** inserting; a bad payload fails the business write.
- The relay (started in `main.ts`) is the only publisher, with `Nats-Msg-Id = outbox id`. **MUST NOT** publish to JetStream from a request path, or after a commit "because it is simpler" — a crash in between loses the event silently.
- A subject not declared in `packages/contracts/src/events/` does not exist; a payload is never `Record<string, unknown>`.

### 8.2 Consuming: idempotent, three outcomes

Every durable consumer is a `JetStreamConsumer` subclass, started from the service's own NATS module (`onModuleInit`, alongside `ensureStreams`), never wired ad hoc in `main.ts`. Nest's `@EventPattern` is core NATS only and **MUST NOT** be used.

- **A subclass names `service` and `subject`, and does one thing in `handle(payload)`** — its own idempotent write. Ack/nak/dead-letter, the request id and schema validation all live once in the base class.
- **Idempotency is the handler's own write:** a conditional update on the status it expects (`WHERE status = 'HELD'`), or an insert guarded by a unique key (`UNIQUE (order_id, kind)`, `UNIQUE (payment_id)`). A redelivery then changes nothing.
- **The handler runs inside `runWithRequestId`, seeded from the message's `x-request-id` header** (or its sequence number, if the header is absent) — the same id that started at the original request follows it all the way to this side effect.
- A handler has three outcomes:

  | Situation | Do | Effect |
  | :---- | :---- | :---- |
  | Transient failure (peer down, deadlock) | `throw` | `nak` with backoff, redelivered |
  | Valid but obsolete (already applied, older status) | `return` | `ack`, dropped |
  | Can never succeed (fails its schema) | `throw new PoisonMessage(reason)` | `term`, copied to the DLQ, logged at `error` |

  Throwing a transient error for a message that can never succeed burns ten deliveries on every restart.

### 8.3 Background jobs

[ADR 0023](./decisions/0023-redis-holds-only-reconstructible-state.md).

- A scheduled job is a **BullMQ repeatable job with a stable `jobId`**, never `@Cron` (which fires once per replica).
- A job is a `<subject>-<verb>.job.ts` class whose method takes `now` (`run(now = new Date())`); tests call it directly and never start a worker.
- **A job that races the request path writes conditionally** — `orders-expire` cancels with the same conditional update as a customer, so an order paid in the same second is never cancelled.

### 8.4 Server-sent events

[ADR 0022](./decisions/0022-order-updates-reach-browsers-as-server-sent-events.md).

- Only the gateway serves SSE. **A frame is never the only record of anything** — it says "order X is now Y", and the page re-reads on every (re)connect.
- The customer stream checks ownership once, at connect, through ordering.
- Streams send a `: ping` comment every 25 s and are closed by the gateway on shutdown.

---

## 9. Security

### 9.1 Hashing — by how the value is looked up

| Value | Function | Why |
| :---- | :---- | :---- |
| `users.password_hash` | bcrypt, cost 12 (`hashPassword` / `verifyPassword`) | low-entropy human secret |
| refresh tokens | SHA-256 hex (`hashToken`) | 256-bit random, looked up **by value** through a unique index — a salted KDF cannot be indexed |
| request fingerprints | SHA-256 hex of canonical JSON (`contentHash`) | identity, not secrecy |

- Passwords are 8–72 **bytes** (`Buffer.byteLength`) — bcrypt ignores everything past 72.
- Login for an unknown email **MUST** still run one bcrypt compare against a fixed dummy hash.
- Compare digests with `timingSafeEqualHex`, never `===`.

### 9.2 Generating secrets

`generateToken()` — 32 random bytes, base64url — is the only way to make a refresh token. **MUST NOT** use `Math.random()` for anything an attacker would like to predict.

### 9.3 Never log, never return

**MUST NOT** appear in a log line, an error message or a response: passwords and their hashes, any token or its hash, Firebase ID tokens, Stripe keys, webhook secrets, `clientSecret`s, full webhook payloads. The logger's redaction list is a backstop, not the mechanism. Mask an email a human must recognise with `maskEmail()`.

### 9.4 Uploads

- The object name is generated by catalog (`products/<productId>/<newId>.<ext>`). **MUST NOT** use a client filename in any path.
- The content type is decided by **magic bytes**, never the extension or `Content-Type`; anything but JPEG, PNG or WebP is refused.
- The gateway caps the multipart body at `PRODUCT_IMAGE_MAX_BYTES` before reading it into memory.

---

## 10. Money and Stripe

### 10.1 Money in code

[ADR 0002](./decisions/0002-every-amount-is-an-integer-number-of-dong.md).

- An amount is a `number` that is a **safe non-negative integer of đồng**, named with its unit — `totalVnd`, `priceDeltaVnd`, `total_vnd`. A bare `price` or `amount` is a naming bug.
- Unit prices are computed only by `computeUnitPrice` from `packages/contracts`; discounts only by `applyPromotion` in ordering's `domain/`. Percentages round **down** (`Math.floor`) in exactly that one function.
- **MUST NOT** trust an amount from a client. The order's total comes from catalog's prices; the payment's amount comes from the order.
- Display formatting is the web app's `formatVnd(amount, locale)` — `₫123,000` in English, `123.000 ₫` in Vietnamese; the currency never changes with the locale. Never divide by 100 — VND has no minor unit.

### 10.2 Stripe

[ADR 0017](./decisions/0017-stripe-checkout-is-the-payment-surface.md).

- One `StripePaymentProvider` in `services/payment/src/providers/payment/`, the only file that imports `stripe`, instantiated with `new Stripe(key, { apiVersion })` — the version pinned in code. **MUST NOT** use a module-level global key.
- The key is **restricted** (`rk_test_…`). No Stripe secret appears in any web variable.
- **MUST NOT** pass `payment_method_types`.
- `checkout.sessions.create` gets the request's `Idempotency-Key`; a refund gets its row id. **Our row is inserted before Stripe's object is created** (rdm-spec P-1).
- **Fulfilment happens only in webhook processing.** The return page, a Server Action or a client callback **MUST NOT** mark anything paid.
- The webhook verifies the signature on the **raw body** before any other work, inserts the event id, and applies the event in one transaction with its outbox row.
- The fake provider implements the same `PaymentProvider` interface and is refused at boot when `NODE_ENV=production`.

---

## 11. The web app

### 11.1 Talking to the API

[ADR 0014](./decisions/0014-the-web-server-is-the-gateways-only-client.md) · [ADR 0015](./decisions/0015-nextjs-server-features-replace-client-data-libraries.md).

- Data is read in **Server Components** and written in **Server Actions**, through the Orval-generated client in `packages/api-client`. **MUST NOT** hand-write a `fetch` to the API — the one exception is the SSE Route Handlers, which stream a body the generated client cannot — and **MUST NOT** import the client into a Client Component — its mutator imports `server-only`, so doing so fails the build.
- The mutator reads `bl_at` from `cookies()`, sets `Authorization`, `X-Request-Id` and `X-Forwarded-For`, and prefixes `API_URL`.
- Every API read is `cache: 'no-store'`. The web app caches no API data (architecture §2.6).
- A Server Action returns `{ ok: true, data } | { ok: false, code, details }` — never throws an API error into the UI. The page renders `code` through `t('errors:<CODE>', details)` (§11.6).
- **Cookies are set only** in `proxy.ts` (refresh) and in the sign-in / sign-out Server Actions — never in a Server Component, where setting one silently does nothing.
- A Server Action that places an order or starts a payment receives the idempotency key **from the client** (generated with `newId()` when the button is tapped, kept in component state across retries) — never generates it itself, or every retry is a new intent.

### 11.2 Client state

- The cart is the only client state that outlives a page: `CartProvider` in the `(customer)` layout, persisted to `localStorage` behind `try/catch`.
- **MUST NOT** copy server data into client state "to cache it". Need it again? Render it on the server again.
- The cart's total is a preview. The checkout page **MUST** display the server's quote.
- The cart is cleared only when the order is seen `PAID`.

### 11.3 Pages and components

- Server Components by default; `'use client'` only for what needs the browser — the cart, the size and topping pickers, the Firebase popup, Stripe's embedded Checkout, `EventSource`.
- Every page that loads data has a `loading.tsx` and an `error.tsx`; every list has an empty state.
- Role-gated sections check the role in their `layout.tsx` on the server. `proxy.ts` redirects early, but the layout is the gate, and the gateway is the real authorization.
- DaisyUI classes first; custom CSS only when DaisyUI and Tailwind utilities cannot express it.

### 11.4 Accessibility

- Every interactive element has an accessible name; an icon-only button has an `aria-label`.
- Order status is shown as text, never colour alone.
- Every form control has a `<label>`; errors are announced (`aria-live="polite"`).
- Touch targets at least 44 × 44 px.

### 11.5 Environment

`NEXT_PUBLIC_*` is compiled into the browser bundle — **only** URLs, the Firebase web config and the Stripe publishable key. Everything else, `API_URL` included, is server-only.

---

### 11.6 Internationalisation

[ADR 0028](./decisions/0028-the-ui-speaks-english-and-vietnamese-through-i18next.md) · architecture §4.7.

- **No user-facing string literal in a component**, including `aria-label`s, `alt` text, placeholders and page titles. Every one is a key: `t('checkout:placeOrder')`. A lint rule (`i18next/no-literal-string`, JSX text only) enforces it.
- **English is the source.** A key is added to `locales/en/<ns>.json` first and to `locales/vi/<ns>.json` in the same PR. A missing Vietnamese key is a failing test, not a fallback to English in production.
- Keys are `camelCase`, grouped by page or component (`cart.empty.title`); error keys are the error code verbatim (`errors:OUT_OF_STOCK`). **MUST NOT** build a key from runtime text.
- Values interpolate with `{{name}}`, never by concatenating translated fragments — word order differs between English and Vietnamese.
- Plurals use `_one` / `_other`; **MUST NOT** branch on `count === 1`.
- Server Components use `getT(ns)`; Client Components use `useTranslation(ns)`. **MUST NOT** create a module-level i18next instance on the server — it would share one visitor's language with every other.
- Money through `formatVnd`, dates through `formatDateTime` — **MUST NOT** call `toLocaleString()` or `Intl` directly in a component.
- Menu content from the API is a `LocalizedText` pair and is rendered with `localized(text, locale)` — **MUST NOT** pick `.vi` or `.en` by hand, and **MUST NOT** turn it into a translation key ([ADR 0031](./decisions/0031-menu-content-is-written-in-english-and-vietnamese.md), rdm-spec §2.10).
- A request schema carrying menu text uses the shared `zLocalizedText` (both languages required, each trimmed, NFC-normalised and bounded) — never two loose string fields.

### 11.7 Guests

[ADR 0029](./decisions/0029-guests-browse-and-build-a-cart-and-sign-in-only-to-order.md) · product-overview §6.8.

- The menu, product and cart pages **MUST** render fully for a guest: they read only `PUBLIC` routes and the client cart, and **MUST NOT** call a `USER` route or assume a `Me`.
- A page that needs an account is listed in `proxy.ts`'s protected set **and** checks the session in its layout. Adding a customer page means deciding which list it belongs to.
- The `next` parameter is used only through `safeNextPath(next)`, which returns a relative path or `/`. **MUST NOT** redirect to a raw `next`.
- The *Checkout* button is always a link to `/checkout`, for guests too — the proxy turns it into the sign-in round trip. No page duplicates that logic.
- Sign-in keeps the cart; sign-out clears it (architecture §4.3).

## 12. Configuration

- Every variable is declared in the service's `src/config/env.schema.ts` as a zod schema and loaded **once at boot** by `createConfigModule(schema)` from `nest-common`. A missing or malformed value stops the process before it listens, one line per problem.
- Read through `ConfigService<Env, true>` with `get(KEY, { infer: true })`. **MUST NOT** read `process.env` outside `prisma.config.ts`, scripts and test setup.
- Real environment variables beat `.env`; images carry no `.env`.
- Every app ships `.env.example` listing every variable, with no secret values. A new variable is added to the schema, the example and architecture §10 in the same PR — a guard spec fails otherwise.
- Product constants (product-overview §8) are constants in `packages/contracts`, not environment variables.
- **Secrets are never defaulted.** A `JWT_PRIVATE_KEY` with a development fallback is a production key waiting to be the fallback.

**Builds** ([ADR 0012](./decisions/0012-swc-compiles-everything-and-nest-packages-are-commonjs.md)):

- Every Nest service's `nest-cli.json` uses the **SWC builder with `typeCheck: true`** (architecture §3.2 has the exact shape). **MUST NOT** turn `typeCheck` off.
- **Type-only imports MUST use `import type`** (`@typescript-eslint/consistent-type-imports`) — except a class injected through a constructor, whose metadata `import type` would erase, making Nest inject `undefined`. The lint rule is configured with `emitDecoratorMetadata` so its autofix leaves those alone.
- Shared packages are compiled to `dist` (CommonJS + `.d.ts`); services never import a sibling's `src`.
- Generated gRPC code and the Orval client are **committed** and checked for drift in CI; the Prisma client is **not** (`generated/`, git-ignored).

---

## 13. Errors and logging

### 13.1 Logging

- `pino` through `nestjs-pino`, JSON, one logger per class; every line carries `requestId`.
- Levels: `debug` developer aid; `info` lifecycle (boot, job run); `warn` handled-but-suspicious (a poison message, a late payment refunded); `error` a bug or a failed dependency, with the error object.
- **MUST NOT** log inside a loop over rows; log the summary.

### 13.2 Handling

- **MUST NOT** swallow an error to satisfy a type. An ignorable error's `catch` carries a `//` comment saying why.
- A retry wraps only an operation that is idempotent or protected by a key.

### 13.3 Production silence

When `NODE_ENV === 'production'`: the error filter returns a generic message for every `5xx` and every `403`, keeping the `code`; `PERMISSION_DENIED` does not name the permission; stack traces never leave the process; Swagger UI is not mounted.

---

## 14. Naming

| Thing | Convention | Example |
| :---- | :---- | :---- |
| File | `kebab-case.<role>.ts` | `order-lifecycle.ts` |
| Service module files | `<module>-grpc.controller.ts`, `<module>.service.ts`, `<module>.consumer.ts`, `<entity>.mapper.ts`, `domain/<rule>.ts` — no repository | `orders-grpc.controller.ts` |
| Gateway module files | `<module>.controller.ts`, `<module>.service.ts`, `<entity>.mapper.ts` | `orders.controller.ts` |
| Peer client | `<peer>-service-grpc.client.ts`, class `<Peer>ServiceGrpcClient` | `catalog-service-grpc.client.ts` |
| Request / response DTO files | `dto/<entity>.dto.ts` / `dto/<entity>-response.dto.ts` | `dto/order-response.dto.ts` |
| Request DTO | `<Name>Dto`, from `createZodDto(schema)` | `PlaceOrderDto` |
| Response DTO | `<Name>ResponseDto` — the suffix is required | `OrderResponseDto` |
| Select shape | `<ENTITY>_<VIEW>_SELECT` with a `<Entity><View>Row` type | `ORDER_DETAIL_SELECT` |
| Mapper, outbound / inbound | `to<TargetType>` / `from<SourceType>` | `toOrderResponseDto`, `fromProtoOrderStatus` |
| Scheduled job | `<subject>-<verb>.job.ts`, job name `<subject>-<verb>` | `orders-expire.job.ts` |
| Error code | `SCREAMING_SNAKE`, states the condition | `OUT_OF_STOCK` |
| Permission | `target.action` | `order.status.update` |
| JetStream subject | `<publisher>.<aggregate>.<past_tense_verb>` | `payment.payment.succeeded` |
| Redis key | `<service>:<scope>[:<id>]` | `catalog:menu` |
| Environment variable | `SCREAMING_SNAKE` | `STRIPE_WEBHOOK_SECRET` |
| `.proto` file / package | `lower_snake.proto` / `brewlite.<service>` | `order_service.proto` / `brewlite.ordering` |
| DB table / column | `snake_case`, tables plural | `order_items.line_total_vnd` |
| Prisma model / field | `PascalCase` singular / `camelCase` | `OrderItem.lineTotalVnd` |
| Enumerated value | `SCREAMING_SNAKE`, stored verbatim | `PAYMENT_FAILED` |
| Constant | `SCREAMING_SNAKE`, unit suffix when it has one | `ORDER_UNPAID_TTL_MS`, `MIN_PAYABLE_VND` |
| Next.js route group / page | `(group)/…/page.tsx`; components `PascalCase.tsx` | `(customer)/cart/page.tsx`, `CartLine.tsx` |
| Server Action | verb first, in `actions.ts` | `placeOrder`, `advanceOrder` |

**Units go in the name:** `totalVnd`, `ttlMs`, `expiresAt`. A bare `timeout` or `price` is a unit bug waiting to happen.

---

## 15. Comments and docblocks

| | Docblock `/** */` | Comment `//` |
| :---- | :---- | :---- |
| Answers | What is this and how do I use it? | What must I not get wrong on this line? |
| Sits on | the declaration | the statement it concerns |

- **MUST** — every exported symbol has a docblock whose first line says what it is.
- **MUST** — cite rdm-spec tables and ADRs by identifier (`rdm-spec O-1`, `ADR 0018`) where code implements one. Those identifiers never move.
- **MUST NOT** — put history or "why not the alternative" in a docblock. History goes in the commit; reasoning in an ADR.
- **MUST NOT** — cite anything under `docs/archive/` (a guard spec fails the build).
- **SHOULD** — a genuine trap gets a short `//` on its line: `// VND is zero-decimal — never × 100`.

---

## 16. Testing

### 16.1 Layers

| Layer | Proves | Uses | Location |
| :---- | :---- | :---- | :---- |
| **Unit — domain** | the state machine, pricing, promotions, loyalty | pure inputs | `**/domain/*.spec.ts`, `packages/contracts/**/*.spec.ts` |
| **Unit — service** | a use case's branches | `PrismaService` and peers mocked | `*.service.spec.ts` beside the source |
| **Integration** | real SQL, constraints, transactions, the outbox row, concurrency | the service's `_test` database, the test broker | `services/<svc>/test/integration/` |
| **Contract** | a gRPC server and a real client over the generated code | in-process server, `_test` | `services/<svc>/test/contract/` |
| **Gateway e2e** | markers, validation, envelope, error mapping, raw webhook body | gRPC peers stubbed | `services/gateway/test/e2e/` |
| **Web e2e** *(P1)* | J1 end to end | Playwright against Compose, fake payments | `apps/web/e2e/` |

### 16.2 Rules

- **Test names state the invariant**, present tense, no "should"; one word in CAPS for what makes the case worth its own test: `it('never oversells under CONCURRENT orders')`.
- **Never mock** the class under test, pure functions from `packages/contracts` or `domain/`, or Prisma in an integration test. **Always mock** Prisma in a unit test and the clock wherever a deadline matters.
- **Every conditional update, unique index and `CHECK` has an integration test proving it refuses** — insert or update the violating row and assert the error.
- **Every consumer has a test delivering the same event twice** and asserting one effect, and one delivering a stale event after a newer state.
- **Every RPC is exercised by a test in the service that owns it**, against its real database.
- Integration suites migrate once and `TRUNCATE … RESTART IDENTITY CASCADE` between specs; suites touching one database run serially. A setup reads its service's `.env` into a local object and **never writes `process.env`**.
- Vitest transforms with `unplugin-swc` with decorator metadata on, or Nest DI resolves `undefined`.

### 16.3 The Task 10 proofs

Graded evidence (product-overview F10). Each is its own named integration test and **MUST** stay green:

| Proof | Test | Asserts |
| :---- | :---- | :---- |
| (a) illegal transitions | `refuses an ILLEGAL transition` — table-driven over every pair not in `ORDER_TRANSITIONS` | `INVALID_STATE`; the row and its history unchanged |
| (b) idempotency | `creates ONE order for two requests with the same Idempotency-Key` — sequential and concurrent; the same for payments | one row; both responses carry the same id; stock reserved once |
| (c) concurrent stock | `never oversells under CONCURRENT orders` — N parallel orders for stock K < N | exactly K succeed, N − K get `OUT_OF_STOCK`, `stock_qty` ends at 0 |

### 16.4 Guard specs

A guard spec turns a repo-wide rule into a failing test. Guards live in `packages/config/guards/` and run as the Vitest project `guards`, in `pnpm test` and as a named CI step. A guard that reads `@brewlite/contracts` reaches its source through a TypeScript `paths` alias, never a package dependency — `contracts` already depends on `config`, and the reverse would be a cycle. Each has four tests: the rule holds over the corpus; planted violations are reported; conforming shapes pass; the corpus is real (non-empty, contains a named file). The corpus comes from `git ls-files`, never a directory walk.

| Guard | Rule |
| :---- | :---- |
| `adr-structure.spec.ts` | every ADR matches `docs/decisions/TEMPLATE.md` and has a row in `docs/README.md` |
| `archive-references.spec.ts` | no markdown file links into `docs/archive/`; no other tracked file names it or cites an implementation doc |
| `module-files.spec.ts` | every file under `services/*/src/modules/` has a known role; `domain/` imports no Nest or Prisma; no `*.repository.ts` |
| `env-contract.spec.ts` | the env schema, `.env.example` and architecture §10 list the same variables |
| `rdm-contract-sync.spec.ts` | every enumerated column in rdm-spec §3 (a leading backticked `A \| B` span) equals its enum in `packages/contracts`, and every `…_MAX_LENGTH` constant equals its column's `VARCHAR(n)` |
| `i18n-keys.spec.ts` | once the web app exists: `apps/web/src/i18n/locales/en` and `vi` have the same namespaces and the same keys (plural suffixes normalised), and every code in `ERRORS` has an `errors` key |
| `api-contract-sync.spec.ts` | api-endpoints-plan §7, §10 and §0.8 agree with `ERRORS` (codes and HTTP status), `PERMISSIONS` / `ROLE_PERMISSIONS` and `RATE_LIMITS`; §8 against the event registry once it exists |

---

## 17. Git and review

- **Trunk-based:** short-lived branches off `main`, named `<type>/<short-topic>` (`feat/order-state-machine`).
- **Conventional Commits**, enforced by commitlint: `feat(ordering): refuse illegal transitions`.
- `main` is protected: a PR, one approving review, green CI. The course's Definition of Done requires the review (product-overview §11.3).
- A PR names the test suites it ran.

---

## 18. Definition of done — pre-PR checklist

### 18.0 Machine checks first, in this order

```bash
pnpm typecheck                              # a type error makes every later result noise
pnpm lint
pnpm format:check
pnpm lint:md                                # if a .md changed
pnpm proto:lint                             # if a .proto changed
pnpm test                                   # unit + guards
pnpm test:integration --filter <service>    # every service you touched
```

### Access

- [ ] The user comes from `@Ctx()`; nothing identity-bearing is accepted from input (§4.1).
- [ ] Resource routes scope the query by the caller and answer `404` for others' resources (§4.2).
- [ ] Exactly one auth marker per route; permission codes exist in `PERMISSIONS` and api-endpoints-plan §10 (§6.3).

### Data

- [ ] Soft-deletable reads filter `deletedAt: null`; deletes stamp `deletedAt` + `deletedById`; no `delete()` on those models; lock columns move together (§7.3).
- [ ] No Prisma `enum`; stored values parsed with `parseEnum` (§7.4).
- [ ] Status writes go through `assertTransition` + a conditional update + a history row (§7.5).
- [ ] Stock writes bump `version` under the lock (§7.6).
- [ ] A new uniqueness rule has its index, a `P2002` catch and a test proving it refuses (§7.7).
- [ ] Amounts are integer đồng with a `Vnd` name; nothing priced from client input (§10.1).
- [ ] rdm-spec updated, with full value lists; §5 and `schema-objects.sql` agree (§7.1).

### Events and jobs

- [ ] Every event written with `outbox.add` inside the causing transaction; subject declared in `packages/contracts` and api-endpoints-plan §8 (§8.1).
- [ ] Every consumer idempotent by its own write, with a poison path, tested with a duplicate and a stale delivery (§8.2).
- [ ] Jobs are repeatable with a stable id, take `now`, and write conditionally (§8.3).

### Surface

- [ ] Request schema `.strict()`; response fields `.nullable()`; PATCH schemas carry no defaults (§6.2).
- [ ] Every error has an `ErrorCode`, declared with `@ApiErrors`, with text in the `errors` namespace in **both** locales (§6.1).
- [ ] The endpoint is documented in api-endpoints-plan with its auth marker and error codes.
- [ ] OpenAPI and the Orval client regenerated and committed if the API changed.
- [ ] New environment variable in the schema, `.env.example` and architecture §10 (§12).

### Security and payments

- [ ] No secret, token, hash or webhook payload in logs, errors or responses (§9.3).
- [ ] Uploads: server-generated names, magic-byte check, size capped before reading (§9.4).
- [ ] Stripe: no `payment_method_types`; our row before Stripe's; fulfilment only from the webhook (§10.2).

### Web

- [ ] The API client is used only on the server; no hand-written `fetch` to the API (§11.1).
- [ ] Loading, empty and error states exist for every new page and list (§11.3).
- [ ] Labels, keyboard access, status as text (§11.4).
- [ ] No string literal in JSX; new keys in `en` and `vi`; money and dates through the formatters (§11.6).
- [ ] A new customer page is either guest-safe or in the proxy's protected set (§11.7).

### Tests and docs

- [ ] Tests at the right layers (§16.1), named per §16.2; the Task 10 proofs still green (§16.3).
- [ ] Exported symbols have docblocks; rdm-spec and ADR identifiers cited where implemented (§15).
- [ ] A new contested decision has an ADR in `decisions/`, not a paragraph in this file.

---

When a rule here conflicts with the code, one of them is wrong — say which in the PR rather than silently following the other. When the code conflicts with an ADR, the ADR is not automatically wrong either: it may record a decision someone drifted from without deciding to.
