# Relational Data Model (RDM) Specification — BrewLite

**Audience:** every developer who writes a migration, a service query, a DTO or an event payload.

**Scope:** every table, column, constraint and index, and every cross-service reference. What the API exposes is [`api-endpoints-plan.md`](./api-endpoints-plan.md); how to write the code that touches these tables is [`development-conventions.md`](./development-conventions.md); why a contested shape was chosen is in [`decisions/`](./decisions/).

**Engine:** PostgreSQL 18 · **ORM:** Prisma 7 · **Topology:** one Postgres server, one database per service ([ADR 0007](./decisions/0007-one-postgres-server-with-a-database-per-service.md)), one `schema.prisma` per service ([ADR 0008](./decisions/0008-services-query-prisma-7-directly.md)).

The course brief names five minimal entities — `Product`, `User`, `Order`, `OrderItem`, `Payment`. They are all here, expanded; §1.10 maps each brief field to its column.

---

## 0. How to read this document

- **Table identifiers are stable and service-prefixed** — `I-` identity, `C-` catalog, `O-` ordering, `P-` payment. The prefix says which database the table lives in: two tables with different prefixes are never joined, never share a transaction and never reference each other by foreign key. Identifiers are cited from code docblocks, so **a table keeps its identifier for life**; a new table takes the next unused number.
- **`FK ➔ x.id`** is a real foreign key inside one database.
- **`ref ➔ service.table.id`** is a *logical* reference to another service's row: a plain UUID column with **no constraint**, checked once at write time over gRPC.
- **Enumerated values** are listed as `A | B | C`. They are `VARCHAR` columns, never Prisma enums ([ADR 0010](./decisions/0010-enumerated-columns-are-strings-not-prisma-enums.md)); the TypeScript source of record is `packages/contracts`. **A value added in code and not here is drift.**
- Physical names are `snake_case`, tables plural; Prisma fields are `camelCase` mapped with `@map` / `@@map`. This document uses physical names.

---

## 1. Core concepts

### 1.1 Four databases

| Service | Database | Tables |
| :---- | :---- | :---- |
| `identity` | `brewlite_identity` | I-1 … I-2 |
| `catalog` | `brewlite_catalog` | C-1 … C-6 |
| `ordering` | `brewlite_ordering` | O-1 … O-6, `outbox_events` |
| `payment` | `brewlite_payment` | P-1 … P-3, `outbox_events` |
| `gateway` | *none* | — |

Each has a paired `brewlite_<service>_test` database with the same schema, and a `_shadow` database used only by the drift check.

### 1.2 Consistency across services

No transaction spans two databases, so every cross-service write is designed for the window where the two sides disagree. The whole lifecycle of one order, and which side is the truth at each step:

```text
place order   ordering ─gRPC PriceItems──▶ catalog          (read; nothing written)
              ordering ─gRPC ReserveStock─▶ catalog         C-2 stock −q, C-6 HELD   (catalog commits)
              ordering: one transaction                     O-1 PENDING, O-2, O-3, promotion use
                 └ fails → ordering ─gRPC ReleaseStock─▶ catalog   (best effort; the orphan sweep is the backstop)
pay           payment ─gRPC BeginPayment─▶ ordering         O-1 deadline extended, current_payment_id set
              payment: P-1 PENDING → Stripe Checkout
webhook       payment: P-1 SUCCEEDED + outbox payment.payment.succeeded
              ordering consumer: O-1 PAID, O-3, O-6 EARN + outbox ordering.order.status_changed
              catalog consumer:  C-6 HELD → CONFIRMED
cancel        ordering: O-1 CANCELLED + outbox ordering.order.status_changed
              catalog consumer:  C-6 → RELEASED, C-2 stock +q
              payment consumer (only from PAID): P-2 refund → payment.refund.succeeded → ordering O-1 REFUNDED
```

Three rules make it hold:

1. **Every event leaves through an outbox** (§2.7) written in the same transaction as the change it announces ([ADR 0006](./decisions/0006-events-leave-through-a-transactional-outbox.md)).
2. **Every consumer is idempotent by its own write** — a conditional update on a status, or an insert guarded by a unique key. Redelivery is a no-op, so no consumer needs a processed-events table.
3. **Every waiting state has a deadline.** An unpaid order expires (O-1 `expires_at`); a reservation whose order never appeared is swept (C-6); a payment that succeeds for an order that is no longer payable is refunded (P-2 `ORDER_NOT_PAYABLE`).

### 1.3 Money

[ADR 0002](./decisions/0002-every-amount-is-an-integer-number-of-dong.md). Every amount is `INTEGER` **đồng**, and its column name ends in `_vnd`. There is no currency column: BrewLite has one currency, and VND has no minor unit. Sums over many rows (reports) are `BIGINT`. A price above `MAX_PRICE_VND` (10,000,000₫) is a validation error.

### 1.4 Snapshots

An order must read the same forever, whatever the menu does afterwards. So **`order_items` (O-2) copies** the product name (in both languages), the size, every topping's name and price, and every price component at the moment of ordering. Nothing in ordering ever re-reads catalog to display an old order. The product id is kept only as a logical reference for reports.

### 1.5 The order state machine, in columns

[ADR 0019](./decisions/0019-order-status-changes-only-through-the-state-machine.md). `orders.status` follows product-overview §6.4. The transition table is `ORDER_TRANSITIONS` in `services/ordering/src/modules/orders/domain/order-lifecycle.ts`, checked by `assertTransition(from, to)`.

**Every status write is a conditional update** — `UPDATE orders SET status = $to, … WHERE id = $id AND status = $from`. Zero rows means someone else moved the order first, which the service reports as `409 INVALID_STATE`. There is no read-then-write window, so two staff tapping the same order, or a webhook racing the expiry job, cannot both succeed.

Every transition inserts one `order_status_history` (O-3) row in the same transaction. That table is what the tracking page shows, and the only record of who cancelled an order.

### 1.6 Stock and reservations

[ADR 0018](./decisions/0018-stock-is-reserved-at-order-creation-under-optimistic-locking.md).

- `products.stock_qty` is `NULL` for a product that is not counted, otherwise the number that can still be sold. `CHECK (stock_qty >= 0)`.
- **Optimistic locking:** every change to `stock_qty` is `UPDATE products SET stock_qty = stock_qty − $q, version = version + 1 WHERE id = $id AND version = $readVersion AND stock_qty >= $q`. Zero rows → re-read and retry, up to `STOCK_RESERVE_MAX_RETRIES` (5); still failing because stock is short → `OUT_OF_STOCK`. The version predicate is the optimistic lock; the stock predicate and the `CHECK` are the floor it cannot break through.
- **All lines of one order reserve in one transaction**, lines of the same product merged first. One short line rolls every line back.
- A **reservation** (C-6) records what was taken, per `(order_id, product_id)`. That key makes a retried `ReserveStock` a no-op, and makes release idempotent: only a `HELD` or `CONFIRMED` row is released, once.

### 1.7 Idempotency

[ADR 0020](./decisions/0020-idempotency-keys-are-enforced-by-a-unique-constraint.md). `orders` and `payments` both carry `idempotency_key` + `request_hash`, with `UNIQUE (user_id, idempotency_key)`.

- A request whose key exists for that user **returns the existing row** when `request_hash` matches, and is refused `422 IDEMPOTENCY_KEY_REUSED` when it does not.
- `request_hash` is the SHA-256 of the canonical JSON of the request body (`contentHash()` in `nest-common`).
- Two concurrent first requests with one key both pass the lookup; the unique index lets one insert win, and the loser catches `P2002`, undoes its side effects (releases its reservation) and returns the winner's row.

### 1.8 Deletion policy

| Data | Deletion | Because |
| :---- | :---- | :---- |
| `users` (I-1) | **soft** (`deleted_at`, `deleted_by_id`) — *deactivation*; separately **locked** (`is_locked`, `locked_until`, `lock_reason`) | orders, payments and loyalty rows point at them; an admin can restore |
| `categories`, `products`, `toppings` (C-1, C-2, C-4) | **soft** (`deleted_at`, `deleted_by_id`) | orders snapshot them but reports and reservations still cite their ids; an admin can restore |
| `promotions` (O-4) | **soft** (`deleted_at`, `deleted_by_id`) | orders cite them by `promotion_id` |
| `orders`, `order_items`, `order_status_history`, `payments`, `refunds`, `loyalty_transactions`, `stripe_events` | **never deleted** | financial and audit records |
| `sessions`, `stock_reservations`, `outbox_events` | hard delete, by expiry or a prune job | nothing cites them afterwards |

**Every read of a soft-deletable table filters `deleted_at IS NULL`**, unless it is an admin read that says so in its name. Prisma has no global filter; see development-conventions §7.3. The shared shape of the columns is §2.9, and the decision is [ADR 0030](./decisions/0030-rows-others-cite-are-soft-deleted-and-accounts-are-locked-or-deactivated.md).

### 1.9 Promotions and loyalty

[ADR 0021](./decisions/0021-promotions-and-loyalty-live-in-the-ordering-service.md). Both live in ordering, so applying a code and crediting points share the order's transaction.

- **A promotion use is counted at placement:** the order transaction locks the promotion row (`SELECT … FOR UPDATE`), re-validates it, and increments `used_count`. Cancelling the order decrements it in the cancel transaction. The row lock serialises two concurrent orders using the same code, which is what keeps `max_uses` and `per_user_limit` exact.
- **The per-customer limit** counts that customer's orders with that `promotion_id` whose status is not `CANCELLED` — no separate redemptions table.
- **Points** are a ledger (O-6) plus a balance (O-5), written together. `UNIQUE (order_id, kind)` means an order earns once, is reversed once, redeems once and is returned once, however often an event is redelivered.

### 1.10 The course brief's entities

| Brief entity and field | Where it lives |
| :---- | :---- |
| `Product(id, name, price, imageUrl, stock)` | C-2 `id`, `name_en` + `name_vi`, `base_price_vnd` (+ C-3 size deltas, C-4 toppings), `image_path` (the URL is built from it), `stock_qty` |
| `User(id, email, passwordHash, loyaltyPoints)` | I-1 `id`, `email`, `password_hash`; **points are O-5 `balance`**, in ordering ([ADR 0021](./decisions/0021-promotions-and-loyalty-live-in-the-ordering-service.md)) |
| `Order(id, userId, status, total, createdAt)` | O-1 `id`, `user_id`, `status`, `total_vnd`, `created_at` (+ `order_no`) |
| `OrderItem(id, orderId, productId, size, qty, lineTotal)` | O-2 `id`, `order_id`, `product_id`, `size`, `qty`, `line_total_vnd` |
| `Payment(id, orderId, idempotencyKey, amount, method)` | P-1 `id`, `order_id`, `idempotency_key`, `amount_vnd`, `method` |

---

## 2. Table-wide conventions

### 2.1 Primary keys

- `id UUID PRIMARY KEY`, **always UUIDv7**, generated in the application (`@default(uuid(7))` or `newId()`) — never a database default ([ADR 0009](./decisions/0009-every-identifier-is-a-uuidv7.md)). "Always" includes non-key UUID columns and client-made ids (`idempotency_key`).
- Junction tables use a composite key of their two references and no `id`.
- Ids are never shown to people as codes. The order number is its own column (O-1 `order_no`).
- Ids from Stripe (`cs_…`, `pi_…`, `re_…`, `evt_…`) are opaque `VARCHAR(255)`, never UUID columns.

### 2.2 Timestamps

- `created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()` on every table.
- `updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()` on every mutable table, maintained by Prisma `@updatedAt` — declared `@default(now()) @updatedAt`, because `@updatedAt` alone gives no database default and a raw insert fails `NOT NULL`. Append-only tables have **no** `updated_at` — its absence documents that the row is never edited.
- Always `TIMESTAMPTZ`, stored in UTC. A calendar day (the sales report) is computed in **`Asia/Ho_Chi_Minh`** through the shared `businessDay()` helper, never the server's zone.

### 2.3 Strings

- Bounded text is `VARCHAR(n)` with `n` equal to the zod limit, both from one constant in `packages/contracts`. Unbounded text does not exist in this schema.
- **Emails** are stored trimmed and lower-cased; `CHECK (email = lower(email))` makes an un-normalised write a database error.
- **Promo codes** are stored upper-case; `CHECK (code = upper(code))`.
- User-entered names are NFC-normalised at the edge before validation, so two encodings of *Cà phê sữa* compare equal.

### 2.4 Enumerated columns

`VARCHAR(16)`, values `SCREAMING_SNAKE_CASE`, no Prisma `enum`. Where a wrong value would be dangerous (`orders.status`, `users.role`), a `CHECK (col IN (…))` in the committed SQL file backs the application check.

### 2.5 JSONB

Allowed only for a value that is always read and written whole and owned by one zod schema in `packages/contracts`, named in the column's description. Never for anything filtered, joined or summed. Today: O-2 `toppings` and `outbox_events.payload`.

### 2.6 Hashes

| Value | Function | Column |
| :---- | :---- | :---- |
| `users.password_hash` | bcrypt, cost 12 | `CHAR(60)` |
| refresh tokens (I-2) | SHA-256 hex — high-entropy, looked up by value through a unique index | `CHAR(64)`, `UNIQUE` |
| request fingerprints (`request_hash`) | SHA-256 hex of canonical JSON | `CHAR(64)` |

### 2.7 Shared table shape: `outbox_events`

In **ordering** and **payment** — the two services that publish. Identical in both.

| Field | Type | Constraints / Default | Description |
| :---- | :---- | :---- | :---- |
| **id** | UUID | PK | Also the event's `eventId` and the JetStream `Nats-Msg-Id`, so a relay re-publish inside the duplicate window is dropped by the broker. |
| **subject** | VARCHAR(128) | NOT NULL | From the registry in `packages/contracts/src/events/`. |
| **payload** | JSONB | NOT NULL | Validated against the subject's zod schema **before** insert; a bad payload fails the business transaction. |
| **aggregate_id** | UUID | NOT NULL | The order or payment the event is about. |
| **request_id** | VARCHAR(64) | Nullable | The `x-request-id` of the request that caused it; the relay copies it into the NATS headers. |
| **created_at** | TIMESTAMPTZ(3) | NOT NULL, now() | — |
| **published_at** | TIMESTAMPTZ(3) | Nullable | NULL = not yet published. |
| **attempts** | INT | NOT NULL, 0 | — |
| **last_error** | VARCHAR(500) | Nullable | — |

- Index: partial `(id) WHERE published_at IS NULL` — the relay's only query.
- The relay claims with `SELECT … WHERE published_at IS NULL ORDER BY id LIMIT $n FOR UPDATE SKIP LOCKED`, publishes, and stamps `published_at`.
- A row published but not stamped (a crash in between) is published again — outside the 2-minute duplicate window that is a real second delivery, and consumers absorb it by design.
- Pruned 7 days after publishing (`outbox-prune`).

### 2.8 The committed SQL file

Everything Prisma cannot declare — partial unique indexes, `CHECK` constraints, the order-number sequence's start — lives in `services/<svc>/prisma/sql/schema-objects.sql` as idempotent statements, each with a comment naming the invariant and the table identifier. It is applied after every `prisma migrate deploy` by `pnpm db:objects`. **§5 is the complete list; the file is its executable form**, and a PR that changes one changes the other.

⚠️ `prisma migrate reset` and `prisma db push` leave a database with every table and **none** of these objects — it boots and serves traffic without its constraints. Always follow either with `pnpm db:objects`.

### 2.9 Shared column shapes: soft delete and locks

[ADR 0030](./decisions/0030-rows-others-cite-are-soft-deleted-and-accounts-are-locked-or-deactivated.md). A table that other rows cite, or that an admin can restore, is **soft-deleted**; it never takes a `DELETE`. Every such table carries the same two columns:

| Field | Type | Constraints / Default | Description |
| :---- | :---- | :---- | :---- |
| **deleted_at** | TIMESTAMPTZ(3) | Nullable | NULL = live. Set = removed from every non-admin read; every other column is kept. |
| **deleted_by_id** | UUID | Nullable | The admin who deleted it: FK ➔ users.id `SET NULL` inside identity, `ref ➔ identity.users.id` elsewhere. `CHECK ((deleted_at IS NULL) = (deleted_by_id IS NULL))` — outside identity, where it cannot be a foreign key; inside identity the `SET NULL` would break that check, so there it is `CHECK (deleted_by_id IS NULL OR deleted_at IS NOT NULL)`. |

- **Restoring** clears both columns. A restore that would collide with a live row's unique value (a name taken meanwhile) is refused `409 <ENTITY>_NAME_TAKEN`.
- **"Does the row come back?"** decides the unique index. Names on the menu (`categories`, `products`, `toppings`) are unique **among live rows** — a partial index `WHERE deleted_at IS NULL` — so a deleted *Trà đào* does not block a new one. Emails and promo codes keep a **full** unique index: a deactivated account is restorable, so its email stays reserved, and an old order names its promo code forever.
- Deleting is an admin action; the service writes `deleted_by_id` from the caller, never from input.

**Locks** exist only on `users` (I-1):

| Field | Type | Constraints / Default | Description |
| :---- | :---- | :---- | :---- |
| **is_locked** | BOOLEAN | NOT NULL, false | **Authoritative.** A locked account cannot sign in or refresh. |
| **locked_until** | TIMESTAMPTZ(3) | Nullable | When a temporary lock lapses; NULL with `is_locked = true` means until an admin unlocks. `CHECK (locked_until IS NULL OR is_locked)`. At most `MAX_LOCK_DURATION_DAYS` ahead. |
| **lock_reason** | VARCHAR(255) | Nullable | Why — for admins, **never shown to the user**. `CHECK (is_locked = (lock_reason IS NOT NULL))`: a lock always has a reason, an unlocked account never keeps one. |

- **An expired lock lifts itself lazily.** Sign-in and refresh run `UPDATE users SET is_locked = false, locked_until = NULL, lock_reason = NULL WHERE id = $1 AND is_locked AND locked_until <= now()` before judging the account. No job sweeps locks; the conditional update is idempotent, so two requests racing it are harmless.
- A lock and a deactivation are independent: an account can be both, and each is lifted on its own.

### 2.10 Bilingual menu text

[ADR 0031](./decisions/0031-menu-content-is-written-in-english-and-vietnamese.md). Everything a customer reads from the menu — category, product and topping names, product descriptions — is stored **in English and in Vietnamese**, as a column pair with the locale as suffix:

| Pair | Rule |
| :---- | :---- |
| `name_en`, `name_vi` | Both `NOT NULL`, same length bound. Each is unique among live rows **in its own language**, case-insensitively — two partial indexes. |
| `description_en`, `description_vi` | Both NULL or both set: `CHECK ((description_en IS NULL) = (description_vi IS NULL))`. |

- **Both languages are required on every write.** An admin form cannot save a product with only one name — the English UI must never fall back to Vietnamese or show a blank.
- Column pairs, not a translations table: two fixed languages, read on every menu request, never a third without a decision. A third locale would be a new column per pair.
- The API carries a pair as one object, `LocalizedText = { en, vi }` (api-endpoints-plan §2.1); the web app picks the reader's locale.
- Order snapshots (O-2) copy **both** languages, so a customer who switches language sees their old orders in it too.
- Admin-only text (`promotions.description`) and customer-typed text (`orders.note`) are single-language — nobody translates them.

---

## 3. Data dictionary

```text
[ identity ] users, sessions
[ catalog  ] categories, products, product_sizes, toppings, product_toppings, stock_reservations
[ ordering ] orders, order_items, order_status_history, promotions, loyalty_accounts,
             loyalty_transactions, outbox_events
[ payment  ] payments, refunds, stripe_events, outbox_events
```

### 3.1 `identity` — accounts and sessions

#### Table I-1: users

*An account. Customers, staff and admins alike; the role says which.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **id** | UUID | PK | The access token's `sub`. |
| **email** | VARCHAR(254) | NOT NULL, **UNIQUE** | Normalised (§2.3). For a Google or Apple account, the verified email Firebase reported. Apple's private-relay addresses are valid emails and are stored as-is. |
| **password_hash** | CHAR(60) | Nullable | bcrypt. **NULL for an account that only signs in with Google or Apple.** Cleared when a Google or Apple sign-in links to an existing password account ([ADR 0013](./decisions/0013-identity-issues-brewlite-tokens-and-firebase-only-proves-sign-ins.md)) — the provider proved the email; the password, set by whoever registered first, is not trusted. |
| **firebase_uid** | VARCHAR(128) | Nullable, **UNIQUE** | The Firebase user this account is linked to. One Firebase user covers both Google and Apple when Firebase links them. |
| **full_name** | VARCHAR(100) | NOT NULL | From registration, or the provider's display name (the email's local part when it has none). |
| **role** | VARCHAR(16) | NOT NULL, `'CUSTOMER'` | `CUSTOMER \| STAFF \| ADMIN`. Changed only by an admin (`PATCH /admin/users/:id/role`). |
| **preferred_locale** | VARCHAR(8) | NOT NULL, `'en'` | `en \| vi` — the UI language the account last chose; the web app sets its locale cookie from it at sign-in (architecture §4.7). |
| **is_locked** | BOOLEAN | NOT NULL, false | §2.9. Locking deletes every session (I-2). |
| **locked_until** | TIMESTAMPTZ(3) | Nullable | §2.9. |
| **lock_reason** | VARCHAR(255) | Nullable | §2.9. Admin-only. |
| **last_login_at** | TIMESTAMPTZ(3) | Nullable | — |
| **created_at** | TIMESTAMPTZ(3) | NOT NULL, now() | — |
| **updated_at** | TIMESTAMPTZ(3) | NOT NULL | — |
| **deleted_at** | TIMESTAMPTZ(3) | Nullable, Indexed | **Deactivation** (§2.9). Restorable. A deactivated account cannot sign in or refresh, and deactivating deletes every session. |
| **deleted_by_id** | UUID | Nullable, FK ➔ users.id, SET NULL | §2.9. |

- `CHECK (password_hash IS NOT NULL OR firebase_uid IS NOT NULL)` — every account has a way in.
- **`email` keeps a full unique index** despite soft delete: a deactivated account can be restored, so its address stays reserved (§2.9). A Google or Apple sign-in whose email belongs to a deactivated account is refused `403 ACCOUNT_DEACTIVATED` — it never creates a second account.
- **The last active admin is protected:** a role change, lock or deactivation that would leave no `ADMIN` that is neither locked nor deleted is refused `409 LAST_ADMIN`, checked inside the transaction with the admin rows locked (`SELECT … FOR UPDATE`). An admin can never lock, deactivate or change the role of themselves (`403 SELF_ACTION_FORBIDDEN`).
- Seeded in development: `admin@brewlite.test`, `staff@brewlite.test`, `customer@brewlite.test` with `SEED_ACCOUNT_PASSWORD`. Anywhere else the first admin comes from `pnpm --filter @brewlite/identity bootstrap:admin`.

#### Table I-2: sessions

*One signed-in browser. The refresh token's server-side half.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **id** | UUID | PK | The access token's `sid`. |
| **user_id** | UUID | NOT NULL, FK ➔ users.id, CASCADE, Indexed | — |
| **refresh_token_hash** | CHAR(64) | NOT NULL, **UNIQUE** | SHA-256 of the refresh token. The token itself exists only in the `bl_rt` cookie. |
| **expires_at** | TIMESTAMPTZ(3) | NOT NULL | `created_at + REFRESH_TOKEN_TTL_MS`. Not extended by use. |
| **last_used_at** | TIMESTAMPTZ(3) | NOT NULL, now() | Updated on refresh. |
| **created_at** | TIMESTAMPTZ(3) | NOT NULL, now() | — |

- Refresh looks the hash up, checks `expires_at`, lifts an expired lock (§2.9), refuses a user who is locked or deleted, and issues a new access token. **The refresh token is not rotated** ([ADR 0014](./decisions/0014-the-web-server-is-the-gateways-only-client.md)).
- Sign-out deletes the row. A role change, a lock or a deactivation deletes every row of the user.
- Expired rows are deleted by `sessions-prune` (identity, daily).

### 3.2 `catalog` — the menu and its stock

#### Table C-1: categories

*A menu section.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **id** | UUID | PK | — |
| **name_en** | VARCHAR(60) | NOT NULL | *Coffee*, *Tea*, *Blended*. §2.10 — unique among live categories (`categories_name_en_live_key`). |
| **name_vi** | VARCHAR(60) | NOT NULL | *Cà phê*, *Trà*, *Đá xay*. §2.10 (`categories_name_vi_live_key`). |
| **sort_order** | SMALLINT | NOT NULL, 0 | Menu order, ascending, then `id` (creation order) — the API takes no locale, so the server cannot sort by a name. |
| **is_active** | BOOLEAN | NOT NULL, true | An inactive category and all its products are hidden from the menu — the reversible *hide for now*; deleting is *gone*. |
| **created_at** | TIMESTAMPTZ(3) | NOT NULL, now() | — |
| **updated_at** | TIMESTAMPTZ(3) | NOT NULL | — |
| **deleted_at** | TIMESTAMPTZ(3) | Nullable | §2.9. Refused `409 CATEGORY_IN_USE` while any live product belongs to it. |
| **deleted_by_id** | UUID | Nullable | §2.9 — ref ➔ identity.users.id. |

#### Table C-2: products

*A drink or snack on the menu.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **id** | UUID | PK | — |
| **category_id** | UUID | NOT NULL, FK ➔ categories.id, RESTRICT, Indexed | — |
| **name_en** | VARCHAR(100) | NOT NULL | *Iced milk coffee*. §2.10 (`products_name_en_live_key`). |
| **name_vi** | VARCHAR(100) | NOT NULL | *Cà phê sữa đá*. §2.10 (`products_name_vi_live_key`). |
| **description_en** | VARCHAR(500) | Nullable | §2.10 — both descriptions or neither. |
| **description_vi** | VARCHAR(500) | Nullable | §2.10. |
| **base_price_vnd** | INT | NOT NULL | `CHECK (base_price_vnd BETWEEN 0 AND 10000000)`. The price before size and toppings. |
| **image_path** | VARCHAR(255) | Nullable | Object path in the Firebase Storage bucket, `products/<productId>/<id>.<ext>`. The API returns a URL built from it and `STORAGE_PUBLIC_BASE_URL`; the path, not the URL, is stored, so the bucket host can change. |
| **is_available** | BOOLEAN | NOT NULL, true | Staff's *sold out* switch. |
| **stock_qty** | INT | Nullable | `NULL` = not counted. Otherwise units still sellable. `CHECK (stock_qty >= 0)`. Changed only by reservation, release, and staff's `PATCH /staff/products/:id/stock` — all under the version lock (§1.6). |
| **version** | INT | NOT NULL, 0 | The optimistic lock. Incremented by **every** write to `stock_qty`, so a concurrent reader always retries. |
| **sort_order** | SMALLINT | NOT NULL, 0 | Order inside the category. |
| **created_at** | TIMESTAMPTZ(3) | NOT NULL, now() | — |
| **updated_at** | TIMESTAMPTZ(3) | NOT NULL | — |
| **deleted_at** | TIMESTAMPTZ(3) | Nullable | §2.9. Removed from the menu; its reservations are still released normally, and old orders keep their snapshots. Restoring needs a live category. |
| **deleted_by_id** | UUID | Nullable | §2.9 — ref ➔ identity.users.id. |

- **A product is sellable** when `deleted_at IS NULL`, `is_available`, its category is live and `is_active`, `stock_qty IS NULL OR stock_qty > 0`, and it has at least one size (C-3). The menu returns unsellable-but-live products with `isSoldOut: true`; `PriceItems` refuses them.
- A write that moves `stock_qty` to or from 0 invalidates the menu cache.

#### Table C-3: product_sizes

*Which sizes a product comes in, and what each adds.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **product_id** | UUID | PK (composite), FK ➔ products.id, CASCADE | — |
| **size** | VARCHAR(1) | PK (composite) | `S \| M \| L` |
| **price_delta_vnd** | INT | NOT NULL | `CHECK (price_delta_vnd BETWEEN 0 AND 10000000)`. Seed default S 0, M 6,000, L 10,000. |

- Replaced as a whole by `PUT /admin/products/:id/sizes`; at least one size is required.

#### Table C-4: toppings

*An add-on sold with drinks.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **id** | UUID | PK | — |
| **name_en** | VARCHAR(60) | NOT NULL | *Tapioca pearls*. §2.10 (`toppings_name_en_live_key`). |
| **name_vi** | VARCHAR(60) | NOT NULL | *Trân châu*. §2.10 (`toppings_name_vi_live_key`). |
| **price_vnd** | INT | NOT NULL | `CHECK (price_vnd BETWEEN 0 AND 10000000)`. |
| **is_available** | BOOLEAN | NOT NULL, true | Toppings are not counted; a topping that ran out is switched off. |
| **created_at** | TIMESTAMPTZ(3) | NOT NULL, now() | — |
| **updated_at** | TIMESTAMPTZ(3) | NOT NULL | — |
| **deleted_at** | TIMESTAMPTZ(3) | Nullable | §2.9. |
| **deleted_by_id** | UUID | Nullable | §2.9 — ref ➔ identity.users.id. |

#### Table C-5: product_toppings

*Which toppings a product allows.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **product_id** | UUID | PK (composite), FK ➔ products.id, CASCADE | — |
| **topping_id** | UUID | PK (composite), FK ➔ toppings.id, CASCADE | — |

- Replaced as a whole by `PUT /admin/products/:id/toppings`. A deleted or unavailable topping stays linked but is not offered.

#### Table C-6: stock_reservations

*Stock taken for one order, per product. Only counted products (`stock_qty IS NOT NULL`) get rows.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **order_id** | UUID | PK (composite) | ref ➔ ordering.orders.id. Generated by ordering **before** the order row exists, which is why a reservation can outlive an order that was never written. |
| **product_id** | UUID | PK (composite), FK ➔ products.id, RESTRICT | — |
| **qty** | INT | NOT NULL | `CHECK (qty > 0)`. All the order's lines of this product, summed. |
| **status** | VARCHAR(16) | NOT NULL, `'HELD'` | `HELD \| CONFIRMED \| RELEASED` |
| **created_at** | TIMESTAMPTZ(3) | NOT NULL, now() | — |
| **updated_at** | TIMESTAMPTZ(3) | NOT NULL | — |

- `HELD` → `CONFIRMED` when the `ordering.order.status_changed` consumer sees the order reach `PAID` — a status change only; the stock was already taken.
- `HELD` or `CONFIRMED` → `RELEASED` when it sees the order reach `CANCELLED`: `stock_qty += qty` and `version += 1` for each row, in one transaction. A redelivered event finds no `HELD` or `CONFIRMED` row and does nothing.
- **Orphan sweep** (`reservations-release-orphans`): a `HELD` row older than `RESERVATION_ORPHAN_TTL_MS` is checked with `ordering.OrderService.GetOrderStatus` — not found or `CANCELLED` → released; `PAID` or later → confirmed; still unpaid → left alone. The sweep never guesses.
- `RELEASED` rows older than 30 days are deleted by the same job.

### 3.3 `ordering` — orders, promotions, loyalty

#### Table O-1: orders

*A committed, server-priced cart. Never deleted.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **id** | UUID | PK | — |
| **order_no** | BIGINT | NOT NULL, **UNIQUE**, from `orders_order_no_seq` (starts at 1000) | The number people read: `#1042`. Never an id, never reused, not reset daily. |
| **user_id** | UUID | NOT NULL | ref ➔ identity.users.id — from the access token, never from input. |
| **status** | VARCHAR(16) | NOT NULL, `'PENDING'` | `PENDING \| PAYMENT_FAILED \| PAID \| PREPARING \| READY \| COMPLETED \| CANCELLED` — transitions per §1.5. |
| **subtotal_vnd** | INT | NOT NULL | Σ O-2 `line_total_vnd`. |
| **promo_discount_vnd** | INT | NOT NULL, 0 | — |
| **points_redeemed** | INT | NOT NULL, 0 | *(P1)* Points spent on this order. |
| **points_discount_vnd** | INT | NOT NULL, 0 | *(P1)* `points_redeemed × LOYALTY_POINT_VALUE_VND`. |
| **total_vnd** | INT | NOT NULL | `CHECK (total_vnd = subtotal_vnd − promo_discount_vnd − points_discount_vnd)` and `CHECK (total_vnd >= 10000)` (`MIN_PAYABLE_VND`). What payment charges — payment never computes an amount. |
| **promotion_id** | UUID | Nullable, FK ➔ promotions.id, RESTRICT | — |
| **promo_code** | VARCHAR(32) | Nullable | Snapshot of the code as applied. `CHECK ((promotion_id IS NULL) = (promo_code IS NULL))`. |
| **note** | VARCHAR(200) | Nullable | The customer's note to the barista. |
| **idempotency_key** | UUID | NOT NULL | `UNIQUE (user_id, idempotency_key)` (§1.7). |
| **request_hash** | CHAR(64) | NOT NULL | — |
| **current_payment_id** | UUID | Nullable | ref ➔ payment.payments.id. The payment attempt in progress, set by `BeginPayment`. A `payment.payment.failed` event for any other payment id is ignored. |
| **expires_at** | TIMESTAMPTZ(3) | NOT NULL | Deadline while unpaid: `created_at + ORDER_UNPAID_TTL_MS`, raised to `now + PAYMENT_WINDOW_MS` by `BeginPayment`. Ignored once paid. |
| **paid_at** | TIMESTAMPTZ(3) | Nullable | Set on reaching `PAID`, kept afterwards. |
| **cancelled_at** | TIMESTAMPTZ(3) | Nullable | — |
| **cancel_reason** | VARCHAR(16) | Nullable | `CUSTOMER \| EXPIRED \| STAFF`. `CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL) AND (cancelled_at IS NULL) = (cancel_reason IS NULL))`. |
| **cancel_note** | VARCHAR(200) | Nullable | Staff's reason, shown to the customer. Required when `cancel_reason = 'STAFF'`. |
| **refund_status** | VARCHAR(16) | NOT NULL, `'NONE'` | `NONE \| PENDING \| REFUNDED \| FAILED`. `PENDING` is set in the transaction that cancels a `PAID` order; `REFUNDED` by the `payment.refund.succeeded` consumer. |
| **points_earned** | INT | NOT NULL, 0 | Credited on `PAID` (§1.9). |
| **created_at** | TIMESTAMPTZ(3) | NOT NULL, now() | — |
| **updated_at** | TIMESTAMPTZ(3) | NOT NULL | — |

- **Placing an order**, in one transaction after catalog reserved the stock: lock and re-validate the promotion, insert O-1, O-2 and the first O-3 row (`from_status` NULL → `PENDING`), increment `promotions.used_count`. Any failure releases the reservation.
- **Reaching `PAID`**: conditional update from `PENDING` or `PAYMENT_FAILED`, `paid_at`, O-3, O-6 `EARN`, O-5 balance, outbox `ordering.order.status_changed` — one transaction.
- **Cancelling**: conditional update, O-3, promotion use given back, O-6 `EARN_REVERSED` when points were earned (and `REDEEM_RETURNED` when redeemed), `refund_status = 'PENDING'` when cancelled from `PAID`, outbox event — one transaction.
- Indexes: `(user_id, id DESC)` — order history; partial `orders_board_idx` and `orders_unpaid_expiry_idx` (§5).

#### Table O-2: order_items

*One line of an order, frozen at the moment of ordering (§1.4).*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **id** | UUID | PK | — |
| **order_id** | UUID | NOT NULL, FK ➔ orders.id, CASCADE, Indexed | — |
| **line_no** | SMALLINT | NOT NULL | 1-based, in cart order. `UNIQUE (order_id, line_no)`. |
| **product_id** | UUID | NOT NULL | ref ➔ catalog.products.id. |
| **product_name_en** | VARCHAR(100) | NOT NULL | Snapshot (§2.10). |
| **product_name_vi** | VARCHAR(100) | NOT NULL | Snapshot (§2.10). |
| **size** | VARCHAR(1) | NOT NULL | `S \| M \| L` |
| **base_price_vnd** | INT | NOT NULL | Snapshot. |
| **size_delta_vnd** | INT | NOT NULL | Snapshot. |
| **toppings** | JSONB | NOT NULL, `'[]'` | Snapshot: `OrderItemToppings` in `packages/contracts` — `[{ toppingId, nameEn, nameVi, priceVnd }]`, at most `MAX_TOPPINGS_PER_LINE`. |
| **unit_price_vnd** | INT | NOT NULL | `base_price_vnd + size_delta_vnd + Σ toppings.priceVnd`, computed by `computeUnitPrice`. |
| **qty** | SMALLINT | NOT NULL | `CHECK (qty BETWEEN 1 AND 10)` (`MAX_QTY_PER_LINE`). |
| **line_total_vnd** | INT | NOT NULL | `CHECK (line_total_vnd = unit_price_vnd * qty)`. |

- Append-only: no `created_at` beyond the order's, no `updated_at`. An order's lines never change after placement.

#### Table O-3: order_status_history

*Every transition of every order. Append-only.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **id** | UUID | PK | UUIDv7, so `ORDER BY id` is chronological. |
| **order_id** | UUID | NOT NULL, FK ➔ orders.id, CASCADE | Index `(order_id, id)`. |
| **from_status** | VARCHAR(16) | Nullable | NULL only on the first row (creation). |
| **to_status** | VARCHAR(16) | NOT NULL | — |
| **actor_type** | VARCHAR(16) | NOT NULL | `CUSTOMER \| STAFF \| SYSTEM \| PAYMENT` |
| **actor_user_id** | UUID | Nullable | ref ➔ identity.users.id. Set for `CUSTOMER` and `STAFF`. `CHECK ((actor_type IN ('CUSTOMER','STAFF')) = (actor_user_id IS NOT NULL))`. |
| **note** | VARCHAR(200) | Nullable | The staff cancel reason; the payment failure reason. |
| **created_at** | TIMESTAMPTZ(3) | NOT NULL, now() | — |

#### Table O-4: promotions

*A promo code.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **id** | UUID | PK | — |
| **code** | VARCHAR(32) | NOT NULL, **UNIQUE** (full) | Upper-case (§2.3), `^[A-Z0-9]{3,32}$`. Never reused, even after deletion — old orders name it (§2.9). |
| **description** | VARCHAR(200) | Nullable | Shown to the admin, not the customer. |
| **discount_type** | VARCHAR(16) | NOT NULL | `PERCENT \| FIXED` |
| **discount_value** | INT | NOT NULL | `PERCENT`: 1–100. `FIXED`: đồng, > 0. `CHECK` per type. |
| **max_discount_vnd** | INT | Nullable | Cap for a `PERCENT` code. `CHECK (discount_type = 'PERCENT' OR max_discount_vnd IS NULL)`. |
| **min_subtotal_vnd** | INT | NOT NULL, 0 | — |
| **starts_at** | TIMESTAMPTZ(3) | NOT NULL | — |
| **ends_at** | TIMESTAMPTZ(3) | NOT NULL | `CHECK (ends_at > starts_at)`. |
| **max_uses** | INT | Nullable | NULL = unlimited. |
| **used_count** | INT | NOT NULL, 0 | Uses by orders not cancelled. `CHECK (used_count >= 0 AND (max_uses IS NULL OR used_count <= max_uses))` — the database refuses an over-use even if the code forgets the lock. |
| **per_user_limit** | SMALLINT | Nullable, 1 | NULL = unlimited per customer. |
| **is_active** | BOOLEAN | NOT NULL, true | The admin's off switch — reversible, still listed. |
| **created_at** | TIMESTAMPTZ(3) | NOT NULL, now() | — |
| **updated_at** | TIMESTAMPTZ(3) | NOT NULL | — |
| **deleted_at** | TIMESTAMPTZ(3) | Nullable | §2.9. A deleted code answers `NOT_FOUND` at checkout. Existing orders keep it, and cancelling one still gives its use back. |
| **deleted_by_id** | UUID | Nullable | §2.9 — ref ➔ identity.users.id. |

- **Validation order**, each failure a `PROMO_CODE_INVALID` reason: `NOT_FOUND` (including deleted) → `INACTIVE` → `NOT_STARTED` → `EXPIRED` → `MIN_SUBTOTAL` → `EXHAUSTED` → `PER_USER_LIMIT`.
- **Discount:** `PERCENT` → `floor(subtotal × value / 100)`, capped by `max_discount_vnd`; `FIXED` → `value`. Then capped so `total_vnd >= MIN_PAYABLE_VND`. One function, `applyPromotion`, in ordering's `domain/`.
- An admin may edit `description`, `ends_at`, `max_uses` (never below `used_count`), `per_user_limit` and `is_active`. The discount itself is immutable once any order used the code — create a new code instead.

#### Table O-5: loyalty_accounts

*A customer's point balance.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **user_id** | UUID | PK | ref ➔ identity.users.id. Created by the first `EARN` (upsert). A customer with no row has 0 points. |
| **balance** | INT | NOT NULL, 0 | `CHECK (balance >= 0)`. Always equal to Σ O-6 `points` for the user — written in the same transaction as every O-6 row. |
| **lifetime_earned** | INT | NOT NULL, 0 | — |
| **created_at** | TIMESTAMPTZ(3) | NOT NULL, now() | — |
| **updated_at** | TIMESTAMPTZ(3) | NOT NULL | — |

- `EARN_REVERSED` on an order whose points were already spent could push the balance below zero; the reversal then takes what is left and records the shortfall in the O-6 row's points. Stated because the `CHECK` would otherwise fail a refund.

#### Table O-6: loyalty_transactions

*The points ledger. Append-only.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **id** | UUID | PK | — |
| **user_id** | UUID | NOT NULL | ref ➔ identity.users.id. Index `(user_id, id DESC)`. |
| **order_id** | UUID | NOT NULL, FK ➔ orders.id, RESTRICT | `UNIQUE (order_id, kind)` — the idempotency of every loyalty write. |
| **kind** | VARCHAR(16) | NOT NULL | `EARN \| EARN_REVERSED \| REDEEM \| REDEEM_RETURNED` |
| **points** | INT | NOT NULL | Signed: `EARN` and `REDEEM_RETURNED` positive, `EARN_REVERSED` and `REDEEM` negative. `CHECK (points <> 0)` — a zero-point order writes no row. |
| **created_at** | TIMESTAMPTZ(3) | NOT NULL, now() | — |

### 3.4 `payment` — payments, refunds, Stripe events

#### Table P-1: payments

*One attempt to pay one order. Never deleted.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **id** | UUID | PK | Also Stripe's `client_reference_id` and in the session's `metadata`. |
| **order_id** | UUID | NOT NULL, Indexed | ref ➔ ordering.orders.id, validated by `BeginPayment`. |
| **user_id** | UUID | NOT NULL | ref ➔ identity.users.id. |
| **amount_vnd** | INT | NOT NULL | `CHECK (amount_vnd >= 10000)`. Copied from the order by `BeginPayment` — **never from the client**. |
| **provider** | VARCHAR(16) | NOT NULL | `STRIPE \| FAKE` — from `PAYMENT_PROVIDER` at creation. |
| **status** | VARCHAR(16) | NOT NULL, `'PENDING'` | `PENDING \| SUCCEEDED \| FAILED \| EXPIRED`. Only `PENDING` moves; the other three are terminal. |
| **method** | VARCHAR(16) | Nullable | `CARD \| GOOGLE_PAY \| APPLE_PAY \| LINK \| OTHER \| FAKE` — what the customer actually paid with, read from the Stripe PaymentIntent's payment method on success. |
| **idempotency_key** | UUID | NOT NULL | `UNIQUE (user_id, idempotency_key)`; forwarded to Stripe as its idempotency key. |
| **request_hash** | CHAR(64) | NOT NULL | — |
| **stripe_checkout_session_id** | VARCHAR(255) | Nullable, **UNIQUE** | Set once the session is created. NULL for `FAKE`. |
| **stripe_payment_intent_id** | VARCHAR(255) | Nullable, **UNIQUE** | Set on success; needed to refund. |
| **failure_reason** | VARCHAR(16) | Nullable | `ASYNC_FAILED \| EXPIRED \| SIMULATED` |
| **expires_at** | TIMESTAMPTZ(3) | Nullable | The Checkout session's expiry. |
| **succeeded_at** | TIMESTAMPTZ(3) | Nullable | `CHECK ((status = 'SUCCEEDED') = (succeeded_at IS NOT NULL))`. |
| **created_at** | TIMESTAMPTZ(3) | NOT NULL, now() | — |
| **updated_at** | TIMESTAMPTZ(3) | NOT NULL | — |

- **At most one `PENDING` payment per order** (`payments_one_pending_per_order`). `POST /payments` for an order that has one returns it instead of creating a second checkout.
- **Our row before Stripe's:** the row is inserted `PENDING` first, then the Checkout session is created with the row's idempotency key and its id stored. A crash in between leaves a row with no session, and the retry creates the session under the same key — Stripe answers with the same session.
- Every status change writes its outbox event in the same transaction.

#### Table P-2: refunds

*A full refund of one successful payment.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **id** | UUID | PK | Also the Stripe idempotency key of the refund call. |
| **payment_id** | UUID | NOT NULL, **UNIQUE**, FK ➔ payments.id, RESTRICT | One refund per payment — a redelivered cancel event hits the unique index and does nothing. |
| **order_id** | UUID | NOT NULL | ref ➔ ordering.orders.id. |
| **amount_vnd** | INT | NOT NULL | Always the full `payments.amount_vnd` — partial refunds are out of scope. |
| **reason** | VARCHAR(24) | NOT NULL | `STAFF_CANCELLED \| ORDER_NOT_PAYABLE` — a paid order cancelled by staff, or a payment that succeeded after its order was cancelled. |
| **status** | VARCHAR(16) | NOT NULL, `'PENDING'` | `PENDING \| SUCCEEDED \| FAILED` |
| **stripe_refund_id** | VARCHAR(255) | Nullable, **UNIQUE** | NULL for `FAKE`, which succeeds at once. |
| **created_at** | TIMESTAMPTZ(3) | NOT NULL, now() | — |
| **updated_at** | TIMESTAMPTZ(3) | NOT NULL | — |

- A `FAILED` refund is logged at `error` and shown on the admin's order view; it is resolved by hand in the Stripe Dashboard. Automated retry is out of scope.

#### Table P-3: stripe_events

*Every Stripe event received. The idempotency of the webhook.*

| Field | Type | Constraints / Default | Description & business logic |
| :---- | :---- | :---- | :---- |
| **id** | VARCHAR(255) | PK | Stripe's `evt_…`. Inserted first, in the transaction that applies the event: a redelivery violates the key, and the handler answers `200` and does nothing. |
| **type** | VARCHAR(64) | NOT NULL | — |
| **received_at** | TIMESTAMPTZ(3) | NOT NULL, now() | — |

- Only the id and type are stored — never the payload, which carries customer data.

---

## 4. Foreign-key behaviour

Only real foreign keys (same database). Cross-service references have no `ON DELETE`; their cleanup is an event named in the owning table's notes.

**`SET NULL`** — keep the row, forget who: `users.deleted_by_id` ➔ `users`. (Users are never hard-deleted, so it fires only in tests.)

**`CASCADE`** — the child is meaningless without the parent: `sessions` ➔ `users`; `product_sizes`, `product_toppings` ➔ `products`; `product_toppings` ➔ `toppings`; `order_items`, `order_status_history` ➔ `orders`. Products, toppings and orders are never hard-deleted (§1.8), so these fire only in tests.

**`RESTRICT`** — refuse the delete; the service answers `409`:

- `products.category_id` ➔ `categories` — a backstop; the service already refuses to soft-delete a category with live products (`409 CATEGORY_IN_USE`).
- `stock_reservations.product_id` ➔ `products`.
- `orders.promotion_id` ➔ `promotions`; `loyalty_transactions.order_id` ➔ `orders`.
- `refunds.payment_id` ➔ `payments`.

---

## 5. Schema objects outside `schema.prisma`

The complete required content of each service's `prisma/sql/schema-objects.sql` (§2.8).

| Service | Object | Kind | Holds |
| :---- | :---- | :---- | :---- |
| identity | `users_email_lower_ck` | CHECK | email is normalised (I-1) |
| identity | `users_role_ck` | CHECK | `role IN ('CUSTOMER','STAFF','ADMIN')` |
| identity | `users_has_credential_ck` | CHECK | a password or a Firebase link |
| identity | `users_locked_until_ck` | CHECK | an end date needs a lock (§2.9) |
| identity | `users_lock_reason_ck` | CHECK | locked ⇔ a reason (§2.9) |
| identity | `users_deleted_by_ck` | CHECK | `deleted_by_id IS NULL OR deleted_at IS NOT NULL` (§2.9) |
| identity | `users_locale_ck` | CHECK | `preferred_locale IN ('en','vi')` |
| catalog | `categories_name_en_live_key`, `categories_name_vi_live_key` | partial unique | `(lower(name_<locale>)) WHERE deleted_at IS NULL` (C-1, §2.10) |
| catalog | `categories_deleted_by_ck`, `products_deleted_by_ck`, `toppings_deleted_by_ck` | CHECK | `(deleted_at IS NULL) = (deleted_by_id IS NULL)` (§2.9) |
| catalog | `products_name_en_live_key`, `products_name_vi_live_key` | partial unique | `(lower(name_<locale>)) WHERE deleted_at IS NULL` (C-2, §2.10) |
| catalog | `products_description_pair_ck` | CHECK | both descriptions or neither (§2.10) |
| catalog | `products_price_ck`, `products_stock_ck` | CHECK | bounds; `stock_qty >= 0` — the floor under optimistic locking |
| catalog | `products_menu_idx` | partial index | `(category_id, sort_order) WHERE deleted_at IS NULL` — the menu query |
| catalog | `product_sizes_size_ck`, `product_sizes_delta_ck` | CHECK | `size IN ('S','M','L')`; bounds |
| catalog | `toppings_name_en_live_key`, `toppings_name_vi_live_key` | partial unique | `(lower(name_<locale>)) WHERE deleted_at IS NULL` (C-4, §2.10) |
| catalog | `toppings_price_ck` | CHECK | bounds |
| catalog | `stock_reservations_qty_ck`, `stock_reservations_status_ck` | CHECK | `qty > 0`; the status set |
| catalog | `stock_reservations_held_idx` | partial index | `(created_at) WHERE status = 'HELD'` — the orphan sweep |
| ordering | `orders_order_no_seq` | sequence | `START WITH 1000` — the order number (O-1) |
| ordering | `orders_status_ck` | CHECK | the status set |
| ordering | `orders_total_ck`, `orders_min_payable_ck` | CHECK | total arithmetic; `total_vnd >= 10000` |
| ordering | `orders_promo_snapshot_ck` | CHECK | promotion ⇔ code |
| ordering | `orders_cancel_ck` | CHECK | cancelled ⇔ `cancelled_at` ⇔ `cancel_reason` |
| ordering | `orders_board_idx` | partial index | `(status, id) WHERE status IN ('PAID','PREPARING','READY')` — the staff board |
| ordering | `orders_unpaid_expiry_idx` | partial index | `(expires_at) WHERE status IN ('PENDING','PAYMENT_FAILED')` — `orders-expire` |
| ordering | `order_items_qty_ck`, `order_items_line_total_ck` | CHECK | line arithmetic |
| ordering | `order_status_history_actor_ck` | CHECK | user actors carry a user id |
| ordering | `promotions_code_upper_ck`, `promotions_value_ck`, `promotions_cap_ck`, `promotions_window_ck`, `promotions_uses_ck`, `promotions_deleted_by_ck` | CHECK | O-4, §2.9 |
| ordering | `loyalty_accounts_balance_ck` | CHECK | `balance >= 0` |
| ordering | `loyalty_transactions_points_ck` | CHECK | `points <> 0` |
| ordering | `outbox_events_unpublished_idx` | partial index | the relay's query (§2.7) |
| payment | `payments_one_pending_per_order` | partial unique | `(order_id) WHERE status = 'PENDING'` (P-1) |
| payment | `payments_amount_ck`, `payments_succeeded_ck` | CHECK | P-1 |
| payment | `refunds_status_ck`, `refunds_reason_ck` | CHECK | P-2 |
| payment | `outbox_events_unpublished_idx` | partial index | the relay's query (§2.7) |

---

## 6. Retention

| Data | Kept for | Mechanism |
| :---- | :---- | :---- |
| Sessions | until expiry | `sessions-prune` (identity, daily) |
| Released reservations | 30 days | `reservations-release-orphans` (catalog) |
| Outbox rows | 7 days after publishing | `outbox-prune` (ordering, payment) |
| Orders, items, history, payments, refunds, loyalty ledger | indefinitely | financial records |
| Stripe event ids | indefinitely | a few bytes per payment |
| Users | indefinitely | soft-deleted (deactivated) or locked, never removed — self-service erasure is out of scope (product-overview §11.4) |
| Soft-deleted categories, products, toppings, promotions | indefinitely | restorable by an admin; nothing purges them |

---

## 7. Open decisions

**None open.** New questions are added here, numbered, and removed when an ADR or a table change resolves them. OD-1 (bilingual menu content) was resolved by [ADR 0031](./decisions/0031-menu-content-is-written-in-english-and-vietnamese.md) — §2.10.
