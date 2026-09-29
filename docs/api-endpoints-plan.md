# API Endpoint Plan — BrewLite

**Audience:** every developer building a route, a page, an RPC or an event handler.

**Scope:** every HTTP endpoint the `gateway` exposes, the service behind it, every server-sent event, every JetStream subject, every internal RPC and every permission. Tables are cited by their [`rdm-spec.md`](./rdm-spec.md) identifiers (`I-1`, `O-4`, …); how to write the code is [`development-conventions.md`](./development-conventions.md); reasons are in [`decisions/`](./decisions/).

**Base URL:** `http://localhost:23100/api/v1` locally — the prefix is `GLOBAL_PREFIX` (`api`), the version comes from Nest URI versioning. Paths below omit `/api/v1`; routes marked *version-neutral* or *unprefixed* say so.

**Who calls it:** the Next.js server, and Stripe's webhook. **Never a browser** ([ADR 0014](./decisions/0014-the-web-server-is-the-gateways-only-client.md)).

The course brief's seven endpoints are all here — `GET /products`, `GET /products/:id`, `POST /auth/register`, `POST /auth/login`, `POST /orders`, `POST /payments`, `GET /orders/me` — with the rest of the product around them.

---

## 0. Conventions

### 0.1 Headers

| Header | Direction | Rule |
| :---- | :---- | :---- |
| `Authorization: Bearer <access token>` | request | Every route except `PUBLIC` and `SIGNATURE`. The web server reads it from the `bl_at` cookie. |
| `Idempotency-Key: <UUIDv7>` | request | **Required** on routes marked ⟳ (§0.6). |
| `X-Request-Id` | both | The web server may send one; the gateway creates one otherwise, echoes it, and passes it to every service, event and log line. |
| `X-Forwarded-For` | request | The web server sets it to the address it saw the browser connect from; the gateway trusts exactly `TRUST_PROXY_HOPS` hops (`1` — the web server). Without it every guest would share the web server's rate-limit bucket. |

### 0.2 Auth markers

Every route declares exactly one:

| Marker | Admits |
| :---- | :---- |
| `PUBLIC` | anyone; a token, if present, is ignored. **This is what a guest can reach** — the menu (§2.1) and signing in (§1.1); the guest's cart never touches the API ([ADR 0029](./decisions/0029-guests-browse-and-build-a-cart-and-sign-in-only-to-order.md)) |
| `USER` | any valid access token — customer, staff or admin |
| `perm:<code>` | an access token whose role grants the permission (§10) |
| `SIGNATURE` | no token; the route verifies a provider signature over the raw body |

**Nothing that creates or reads an order, a payment or points is `PUBLIC`.** Quoting, ordering, paying, history and loyalty are all `USER` — a guest reaches them only after signing in (product-overview §6.8).

**Ownership is checked in the service, in the query.** A `USER` route that addresses a resource (`/orders/:id`, `/payments/:id`) scopes the lookup by the caller's user id; **someone else's resource is `404 RESOURCE_NOT_FOUND`, never `403`** — a `403` would confirm the id exists.

### 0.3 Response shapes

**Success** — the payload under `data`; `meta` only for lists:

```json
{ "data": { "id": "…" } }
{ "data": [ … ], "meta": { "nextCursor": "…" } }
```

**Error** — one shape for every failure:

```json
{ "error": { "code": "OUT_OF_STOCK", "message": "…", "details": { "products": [ { "productId": "…", "available": 0 } ] }, "requestId": "…" } }
```

- **`code` is the contract; `message` is not.** Codes are `SCREAMING_SNAKE`, registered in `ERRORS` in `packages/contracts` with their HTTP status, gRPC status and `details` schema (§7). The web app renders Vietnamese text from the code. `message` is English, for developers, and generic in production.
- Validation failures are `400 VALIDATION_FAILED` with `details.issues: [{ path, code }]` — `path` an RFC 6901 JSON pointer (`''` for the root, `~0` / `~1` escapes), `code` a zod issue code.
- `204` responses have no body. Ops routes (§11) are not wrapped.

| HTTP | Used for |
| :---- | :---- |
| `400` | malformed input, failed validation, missing idempotency key, bad webhook signature |
| `401` | no valid token, wrong credentials |
| `403` | valid token, missing permission; a locked or deactivated account signing in |
| `404` | not found — **and** exists but belongs to someone else |
| `409` | state conflict: illegal transition, uniqueness, stale version, out of stock |
| `422` | well-formed but refused by a business rule — an invalid promo code, an unavailable product |
| `429` | rate limit; `Retry-After` set |
| `500` | unexpected — `INTERNAL`, logged as a bug |
| `503` | a required service or provider is down |
| `504` | a required service did not answer within its deadline |

### 0.4 Pagination

| Style | Query | Meta | Used by |
| :---- | :---- | :---- | :---- |
| **Cursor** | `?cursor=&limit=` | `{ nextCursor: string \| null }` | customer lists that grow: `GET /orders/me` |
| **Page** | `?page=&pageSize=&sort=` | `{ page, pageSize, total }` | admin tables |

`limit` / `pageSize` default 20, max 100. `sort` is `field` or `-field` from a per-route allowlist; anything else is `400`. The cursor is opaque — clients never parse it.

Bounded lists with no pagination — the menu (`MAX_MENU_PRODUCTS`, 200), categories (`MAX_MENU_CATEGORIES`, 50), the staff board (100) — say so in their row.

### 0.5 Identifiers

Every id is a **UUIDv7** ([ADR 0009](./decisions/0009-every-identifier-is-a-uuidv7.md)); the edge refuses anything else, including a valid v4, with `400 VALIDATION_FAILED`. The order number (`orderNo`, e.g. `1042`) is a JSON number, shown as `#1042`, and never accepted as an id.

### 0.6 Idempotency

[ADR 0020](./decisions/0020-idempotency-keys-are-enforced-by-a-unique-constraint.md). Routes marked **⟳** — `POST /orders` and `POST /payments` — require `Idempotency-Key: <UUIDv7>`.

- The web app creates the key **when the customer taps the button** and reuses it for every retry of that tap; a new tap is a new key.
- Missing key → `400 IDEMPOTENCY_KEY_REQUIRED`.
- Same key, same body → the original resource, `200` (the first call answered `201`).
- Same key, different body → `422 IDEMPOTENCY_KEY_REUSED`.
- The guarantee is a unique index in the owning service's database (rdm-spec §1.7), so it holds across concurrent requests, replicas and restarts.

### 0.7 Money

Every amount is an integer number of đồng, in a field ending `Vnd` — `totalVnd: 123000` ([ADR 0002](./decisions/0002-every-amount-is-an-integer-number-of-dong.md)). Never a float, never a formatted string.

### 0.8 Rate limits

The gateway's own `RateLimitGuard` (conventions §6.3): fixed window, `INCR` + `PEXPIRE NX` per key `gw:rl:<class>:<kind>:<value>` on ioredis, fail-open on a Redis outage. Every route has one class, set with `@RateLimit(class | 'NONE')`; the numbers are `RATE_LIMITS` in `packages/contracts`.

| Class | Key | Limit | Routes |
| :---- | :---- | :---- | :---- |
| `PUBLIC_READ` | IP | 120 / min | menu reads |
| `AUTH` | IP **and** email | 10 / 15 min | register, login, Firebase exchange |
| `SESSION` | IP | 60 / min | refresh, logout |
| `ORDER_WRITE` | user | 20 / min | quote, place, cancel |
| `PAYMENT` | user | 10 / min | start a payment, fake confirm |
| `AUTHENTICATED` | user | 300 / min | everything else with a token |
| none | — | — | webhook, ops, SSE streams |

A Redis outage fails **open** with an error log line — a rate limiter must not take the shop down.

### 0.9 Versioning

Versions are **per route** (`@Version('2')` on the one route that breaks), never per API. Additive changes — a new field, a new route, a new enum value — are never a new version. The Stripe webhook is **version-neutral** (a URL registered with Stripe never moves); `/health`, `/health/ready` and `/version` are **unprefixed**.

### 0.10 Caching

Account-specific responses are `Cache-Control: private, no-store`. Menu reads are cached inside catalog, not over HTTP ([ADR 0023](./decisions/0023-redis-holds-only-reconstructible-state.md)).

---

## 1. `identity` — accounts and sessions

### 1.1 Authentication — `/auth`

*Backed by:* `identity.AuthService` · I-1, I-2.

Every route that signs someone in returns the same **session** shape — the web server turns it into the two cookies and never forwards the tokens to the browser:

```ts
Session = {
  user: Me;                          // §1.2 — the web server also sets `bl_locale` from `user.preferredLocale`
  accessToken: string; accessTokenExpiresAt: string;
  refreshToken: string; refreshTokenExpiresAt: string;
}
```

| Method | Path | Description | Auth |
| :---- | :---- | :---- | :---- |
| POST | `/auth/register` | `{ email, password, fullName, preferredLocale? }` → `201 Session`. Creates I-1 as `CUSTOMER` and a session; `preferredLocale` is the locale the guest was browsing in (`en` when absent). Password 8–72 **bytes**. `409 EMAIL_TAKEN`. | PUBLIC · `AUTH` |
| POST | `/auth/login` | `{ email, password }` → `200 Session`. Unknown email, wrong password and an account with no password are **the same** `401 INVALID_CREDENTIALS`, with the same timing. **The password is verified first** — only once it matches is an expired lock lifted (rdm-spec §2.9) and `403 ACCOUNT_LOCKED` (`details.lockedUntil`, `null` when indefinite — never the reason) or `403 ACCOUNT_DEACTIVATED` revealed; checking the lock before the password would tell anyone who types an email whether the account exists and is locked. | PUBLIC · `AUTH` |
| POST | `/auth/firebase` | `{ idToken }` — a Firebase ID token from a Google or Apple sign-in → `200 Session` (`201` when the account was created). Verified with `firebase-admin`; the provider must be `google.com` or `apple.com` and the email verified, else `401 FIREBASE_TOKEN_INVALID` (`details.reason: INVALID \| PROVIDER \| EMAIL_UNVERIFIED`). Finds the user by `firebase_uid`, then by email — **linking to an existing password account clears its password and deletes its sessions** ([ADR 0013](./decisions/0013-identity-issues-brewlite-tokens-and-firebase-only-proves-sign-ins.md)) — else creates a `CUSTOMER`. An account already linked to a **different** Firebase uid is **re-linked** to the new one: the verified email is the proof ADR 0013 accepts, and refusing would lock the person out of their own account. Two tabs signing in for the first time race the insert — the loser's create hits the `firebase_uid` or `email` unique index and **retries once**, which then finds the winner. `403 ACCOUNT_LOCKED` or `403 ACCOUNT_DEACTIVATED`, as for login — a deactivated account's email never becomes a second account. | PUBLIC · `AUTH` |
| POST | `/auth/refresh` | `{ refreshToken }` → `200 { accessToken, accessTokenExpiresAt }`. Unknown, expired, or the user locked or deactivated → `401 UNAUTHENTICATED` (the web server then clears the cookies — the visitor is a guest again). The refresh token is not rotated. | PUBLIC · `SESSION` |
| POST | `/auth/logout` | `{ refreshToken }` → `204`. Deletes the session; an unknown token is still `204`. | PUBLIC · `SESSION` |

### 1.2 Own account — `/users/me`

```ts
Me = { id; email; fullName; role: 'CUSTOMER' | 'STAFF' | 'ADMIN'; permissions: string[]; hasPassword: boolean;
       preferredLocale: 'en' | 'vi'; createdAt }
```

| Method | Path | Description | Auth |
| :---- | :---- | :---- | :---- |
| GET | `/users/me` | `Me`. `permissions` is `ROLE_PERMISSIONS[role]` — the web app uses it to show or hide staff and admin links. A deactivated account holding a still-valid access token gets `401 UNAUTHENTICATED`, not `404` — the account is gone for them, and `401` is what makes the web server clear the cookies. | USER |
| PATCH | `/users/me` | `{ fullName?, preferredLocale? }` → `Me`. Nothing else is self-service. | USER |
| PATCH | `/users/me/password` *(P1)* | `{ currentPassword?, newPassword }` → `204`. `currentPassword` required when the account has one (`403 CURRENT_PASSWORD_INCORRECT`); a Google-only account may set a first password. Deletes every *other* session. | USER · `AUTH` |

### 1.3 User administration — `/admin/users`

```ts
AdminUser = Me & { isLocked: boolean; lockedUntil: string | null; lockReason: string | null;
                   deletedAt: string | null; deletedById: string | null; lastLoginAt: string | null }
```

| Method | Path | Description | Auth |
| :---- | :---- | :---- | :---- |
| GET | `/admin/users` | `?q=` (email or name) `&role=&locked=&deleted=` — `deleted` defaults to `false`, `true` lists only deactivated accounts. Page style, sort `createdAt`, `email`, default **`-createdAt`**. `AdminUser[]`. | perm:`user.manage` |
| GET | `/admin/users/:id` | `AdminUser`, deactivated or not. | perm:`user.manage` |
| PATCH | `/admin/users/:id/role` | `{ role }` → `AdminUser`. Deletes all their sessions, so the new role applies at their next sign-in (and their current access token lapses within 15 min). | perm:`user.manage` |
| POST | `/admin/users/:id/lock` | `{ reason, lockedUntil? }` → `AdminUser`. `reason` ≤ `LOCK_REASON_MAX_LENGTH`; `lockedUntil` in the future, at most `MAX_LOCK_DURATION_DAYS` away, absent = until unlocked. Re-locking a locked account replaces its reason and end. Deletes all sessions. | perm:`user.manage` |
| POST | `/admin/users/:id/unlock` | → `AdminUser`. Clears `is_locked`, `locked_until` and `lock_reason` together. | perm:`user.manage` |
| DELETE | `/admin/users/:id` | **Deactivate** (soft delete) → `204`. Stamps `deleted_at` and `deleted_by_id`, deletes all sessions. | perm:`user.manage` |
| POST | `/admin/users/:id/restore` | → `AdminUser`. Clears `deleted_at` and `deleted_by_id`; a lock, if any, stays. | perm:`user.manage` |

Every write checks, in this order: (1) the target exists, deactivated included, else `404 RESOURCE_NOT_FOUND`; (2) role change, lock and deactivate are refused `403 SELF_ACTION_FORBIDDEN` on yourself — unlock and restore have no self-check; (3) state — an already-deactivated account answers `409 INVALID_STATE` (`details.status: 'DEACTIVATED'`) to lock, role change and deactivate, a live one answers it (`details.status: 'ACTIVE'`) to restore; (4) the last-admin rule — role change (losing `ADMIN`), lock and deactivate on an `ADMIN` refuse `409 LAST_ADMIN` when they would leave no **effective** admin, an admin that is neither locked nor deactivated — an expired, not-yet-lifted lock counts as unlocked, since it lifts at the next sign-in.

There is no "create staff" route: a barista registers like anyone else, and an admin changes their role.

---

## 2. `catalog` — the menu

*Backed by:* `catalog.MenuService`, `catalog.AdminMenuService`, `catalog.StockService` · C-1 … C-6.

### 2.1 Public menu

```ts
LocalizedText  = { en: string; vi: string }                 // rdm-spec §2.10 — both always present
ProductSummary = { id; categoryId; name: LocalizedText; imageUrl: string | null; fromPriceVnd; isSoldOut: boolean }
ProductDetail  = ProductSummary & {
  description: LocalizedText | null; basePriceVnd;
  sizes: { size: 'S' | 'M' | 'L'; priceDeltaVnd }[];      // offered sizes, S→L
  toppings: { id; name: LocalizedText; priceVnd }[];       // allowed AND available
  maxToppings: number;                                     // MAX_TOPPINGS_PER_LINE
}
```

`fromPriceVnd` is the base price plus the smallest size delta. **No stock count is exposed** — only `isSoldOut`.

**Menu text comes in both languages in every response** ([ADR 0031](./decisions/0031-menu-content-is-written-in-english-and-vietnamese.md)); the API takes no locale parameter, so one cached menu serves every reader and the web app picks `name.en` or `name.vi`.

| Method | Path | Description | Auth |
| :---- | :---- | :---- | :---- |
| GET | `/categories` | Active categories, by `sort_order` then `id`: `{ id, name: LocalizedText }[]`, bounded by `MAX_MENU_CATEGORIES`. | PUBLIC · `PUBLIC_READ` |
| GET | `/products` | The menu: every live product in an active category, `?categoryId=` optional, ordered by category then `sort_order` — `ProductSummary[]`, bounded by `MAX_MENU_PRODUCTS`. Sold-out products are included with `isSoldOut: true`. Served from the Redis menu cache. | PUBLIC · `PUBLIC_READ` |
| GET | `/products/:id` | `ProductDetail`. A deleted product, or one in a deleted or inactive category, is `404`. | PUBLIC · `PUBLIC_READ` |

### 2.2 Staff — availability and stock

| Method | Path | Description | Auth |
| :---- | :---- | :---- | :---- |
| GET | `/staff/products` | Every live product with `{ id, name: LocalizedText, categoryId, isAvailable, stockQty, version }`, bounded. | perm:`stock.update` |
| PATCH | `/staff/products/:id/availability` | `{ isAvailable }` → the row. Invalidates the menu cache. | perm:`stock.update` |
| PATCH | `/staff/products/:id/stock` | `{ stockQty: number \| null, expectedVersion }` → the row. `null` stops counting. Under the same optimistic lock as reservations: a stale `expectedVersion` is `409 STOCK_VERSION_CONFLICT` (`details.currentVersion`, `details.currentStockQty`) — the page reloads and staff re-enters. | perm:`stock.update` |
| PATCH | `/staff/toppings/:id/availability` | `{ isAvailable }`. | perm:`stock.update` |

### 2.3 Admin — menu management

| Method | Path | Description | Auth |
| :---- | :---- | :---- | :---- |
| GET | `/admin/categories` | All live categories, including inactive; `?deleted=true` lists only deleted ones. | perm:`menu.manage` |
| POST | `/admin/categories` | `{ name: LocalizedText, sortOrder?, isActive? }` — both languages required. `409 CATEGORY_NAME_TAKEN` (`details.locale`). | perm:`menu.manage` |
| PATCH | `/admin/categories/:id` | `{ name?: LocalizedText, sortOrder?, isActive? }` — a name is replaced as a whole pair, never one language. | perm:`menu.manage` |
| DELETE | `/admin/categories/:id` | Soft delete → `204`. `409 CATEGORY_IN_USE` while any live product belongs to it. | perm:`menu.manage` |
| POST | `/admin/categories/:id/restore` | `204`. `409 CATEGORY_NAME_TAKEN` if a live category took the name meanwhile. | perm:`menu.manage` |
| GET | `/admin/products` | `?q=&categoryId=&deleted=`, page style (`deleted` defaults to `false`). Full rows including stock and `imageUrl`. | perm:`menu.manage` |
| GET | `/admin/products/:id` | Full row + sizes + allowed topping ids. | perm:`menu.manage` |
| POST | `/admin/products` | `{ categoryId, name: LocalizedText, description?: LocalizedText, basePriceVnd, sizes: [{ size, priceDeltaVnd }], toppingIds: [], stockQty?, sortOrder? }` — at least one size. `409 PRODUCT_NAME_TAKEN` (`details.locale`); `422 RESOURCE_REFERENCE_INVALID` for an unknown category or topping. | perm:`menu.manage` |
| PATCH | `/admin/products/:id` | `{ categoryId?, name?: LocalizedText, description?: LocalizedText \| null, basePriceVnd?, sortOrder? }` — pairs replaced whole; `description: null` clears both. **Stock is not editable here** — it has its own versioned route (§2.2). A price change never touches existing orders (rdm-spec §1.4). | perm:`menu.manage` |
| PUT | `/admin/products/:id/sizes` | Replace: `[{ size, priceDeltaVnd }]`, non-empty, no duplicate size. | perm:`menu.manage` |
| PUT | `/admin/products/:id/toppings` | Replace: `{ toppingIds }`. | perm:`menu.manage` |
| PUT | `/admin/products/:id/image` | `multipart/form-data`, field `file`, ≤ 2 MB, JPEG / PNG / WebP by **magic bytes**, else `422 IMAGE_INVALID`. → `{ imageUrl }`. Replaces and deletes the previous image. | perm:`menu.manage` |
| DELETE | `/admin/products/:id/image` | `204`. | perm:`menu.manage` |
| DELETE | `/admin/products/:id` | Soft delete → `204`. Removes it from the menu; existing orders and held reservations are unaffected. | perm:`menu.manage` |
| POST | `/admin/products/:id/restore` | `204`. `409 PRODUCT_NAME_TAKEN` if a live product took the name meanwhile; `409 INVALID_STATE` if its category is deleted (restore the category first). | perm:`menu.manage` |
| GET | `/admin/toppings` | All live, `?deleted=true` for deleted ones. | perm:`menu.manage` |
| POST | `/admin/toppings` | `{ name: LocalizedText, priceVnd }`. `409 TOPPING_NAME_TAKEN` (`details.locale`). | perm:`menu.manage` |
| PATCH | `/admin/toppings/:id` | `{ name?: LocalizedText, priceVnd?, isAvailable? }`. | perm:`menu.manage` |
| DELETE | `/admin/toppings/:id` | Soft delete → `204`. | perm:`menu.manage` |
| POST | `/admin/toppings/:id/restore` | `204`. `409 TOPPING_NAME_TAKEN` on a name clash. | perm:`menu.manage` |

Every write here invalidates the menu cache after it commits.

---

## 3. `ordering` — orders, promotions, loyalty

*Backed by:* `ordering.OrderService`, `ordering.StaffOrderService`, `ordering.PromotionService`, `ordering.LoyaltyService` · O-1 … O-6.

### 3.1 Shapes

```ts
CartLine = { productId; size: 'S' | 'M' | 'L'; toppingIds: string[]; qty }   // 1 ≤ qty ≤ 10, ≤ 3 toppings, ≤ 20 lines

Quote = {
  lines: { productId; productName: LocalizedText; size; toppings: { toppingId; name: LocalizedText; priceVnd }[];
           unitPriceVnd; qty; lineTotalVnd }[];
  subtotalVnd; promoDiscountVnd; pointsDiscountVnd; totalVnd;
  promoCode: string | null;
  pointsEarnable: number;                 // what paying this total would earn
}

Order = Quote & {
  id; orderNo; status; note: string | null;
  expiresAt: string | null;               // the payment deadline, only while PENDING / PAYMENT_FAILED
  paidAt: string | null; createdAt;
  cancelReason: 'CUSTOMER' | 'EXPIRED' | 'STAFF' | null; cancelNote: string | null;
  refundStatus: 'NONE' | 'PENDING' | 'REFUNDED' | 'FAILED';
  pointsEarned: number;
  history: { fromStatus: string | null; toStatus; actorType; note: string | null; at }[];
}
```

### 3.2 Customer orders

| Method | Path | Description | Auth |
| :---- | :---- | :---- | :---- |
| POST | `/orders/quote` | `{ items: CartLine[], promoCode?, pointsToRedeem? }` → `Quote`. Prices through catalog and validates the code; **writes nothing and reserves nothing**. Refusals, in this order: `422 PRODUCT_UNAVAILABLE` (`details.productIds`), `422 OPTION_INVALID` (`details.lineIndex`, `details.reason: SIZE \| TOPPING \| TOO_MANY_TOPPINGS`), `409 OUT_OF_STOCK` (read-only check, `details.products`), `422 PROMO_CODE_INVALID` (`details.reason`, rdm-spec O-4), `422 POINTS_INSUFFICIENT` *(P1)*, `422 ORDER_TOTAL_TOO_LOW`. The web app marks the named lines unavailable. | USER · `ORDER_WRITE` |
| POST | `/orders` ⟳ | `{ items, promoCode?, pointsToRedeem?, note? }` → `201 Order` (`PENDING`). The same refusals as the quote, where `OUT_OF_STOCK` now comes from the actual reservation, plus `409 STOCK_CONTENDED` when the optimistic lock kept losing (retry with the same key). The sequence is §6.1. | USER · `ORDER_WRITE` |
| GET | `/orders/me` | Cursor style, newest first, `?status=` optional. Each item is the `Order` without `history`. | USER |
| GET | `/orders/:id` | `Order`. Someone else's → `404`. | USER |
| POST | `/orders/:id/cancel` | → `Order` (`CANCELLED`, reason `CUSTOMER`). Only from `PENDING` or `PAYMENT_FAILED`; otherwise `409 INVALID_STATE` (`details.status`). | USER · `ORDER_WRITE` |
| GET | `/orders/:id/events` | **SSE** stream of this order's status changes (§5). | USER |

### 3.3 Staff — the order board

| Method | Path | Description | Auth |
| :---- | :---- | :---- | :---- |
| GET | `/staff/orders` | Orders in `PAID`, `PREPARING`, `READY`, oldest first, `?status=` to narrow; bounded to 100. Each is the `Order` without `history`. | perm:`order.board.read` |
| POST | `/staff/orders/:id/status` | `{ to: 'PREPARING' \| 'READY' \| 'COMPLETED' }` → `Order`. Checked by `assertTransition` and a conditional update — a move not in product-overview §6.4, or an order another tap already moved, is `409 INVALID_STATE` (`details.status` = the current status). | perm:`order.status.update` |
| POST | `/staff/orders/:id/cancel` | `{ note }` (required, ≤ 200) → `Order`. `PAID` → `CANCELLED` (reason `STAFF`): releases stock, reverses points, returns the promo use, sets `refundStatus: PENDING`; payment refunds (§8). Any other status is `409 INVALID_STATE`. | perm:`order.cancel.paid` |
| GET | `/staff/orders/events` | **SSE** stream of every order's status changes (§5). | perm:`order.board.read` |

### 3.4 Admin — orders and reports

| Method | Path | Description | Auth |
| :---- | :---- | :---- | :---- |
| GET | `/admin/orders` *(P1)* | `?status=&from=&to=&orderNo=`, page style, sort `createdAt`, `totalVnd`. | perm:`order.read.all` |
| GET | `/admin/orders/:id` *(P1)* | `Order` with `history`, plus `payments` from payment (`payment.PaymentService.ListPaymentsForOrder`). If payment is down: `payments: null`, `meta.degraded: ["payment"]` — the order still shows. | perm:`order.read.all` |
| GET | `/admin/reports/sales` *(P1)* | `?from=&to=` (business days, inclusive, ≤ 93 days) → `{ days: [{ day, orders, revenueVnd }], topProducts: [{ productId, productName: LocalizedText, qty, revenueVnd }] }`. Counts orders that reached `PAID` and were not refunded. | perm:`report.read` |

### 3.5 Promotions — `/admin/promotions`

```ts
Promotion = { id; code; description: string | null; discountType: 'PERCENT' | 'FIXED'; discountValue;
              maxDiscountVnd: number | null; minSubtotalVnd; startsAt; endsAt;
              maxUses: number | null; usedCount; perUserLimit: number | null; isActive; createdAt }
```

| Method | Path | Description | Auth |
| :---- | :---- | :---- | :---- |
| GET | `/admin/promotions` | `?active=&deleted=&q=`, page style. | perm:`promotion.manage` |
| POST | `/admin/promotions` | Everything but `id`, `usedCount`, `createdAt`. Code normalised to upper case. `409 PROMO_CODE_TAKEN`. | perm:`promotion.manage` |
| GET | `/admin/promotions/:id` | `Promotion`. | perm:`promotion.manage` |
| PATCH | `/admin/promotions/:id` | `{ description?, endsAt?, maxUses?, perUserLimit?, isActive? }`. `maxUses` below `usedCount` is `422 PROMO_MAX_USES_BELOW_USED`. The discount itself never changes (rdm-spec O-4). | perm:`promotion.manage` |
| DELETE | `/admin/promotions/:id` | Soft delete → `204`. The code stops working at once (`PROMO_CODE_INVALID`, `NOT_FOUND`); orders that used it are unaffected. | perm:`promotion.manage` |
| POST | `/admin/promotions/:id/restore` | `204`. | perm:`promotion.manage` |

### 3.6 Loyalty — `/loyalty/me`

| Method | Path | Description | Auth |
| :---- | :---- | :---- | :---- |
| GET | `/loyalty/me` | `{ balance, lifetimeEarned, recent: [{ orderId, orderNo, kind, points, at }] }` — the 20 most recent ledger rows. A customer with no account row gets zeros. | USER |

---

## 4. `payment` — paying for an order

*Backed by:* `payment.PaymentService` · P-1 … P-3.

```ts
Payment = { id; orderId; status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED'; provider: 'STRIPE' | 'FAKE';
            amountVnd; method: string | null; clientSecret: string | null; expiresAt: string | null; createdAt }
```

`clientSecret` is present only while `PENDING` with provider `STRIPE` — it mounts the embedded Checkout.

| Method | Path | Description | Auth |
| :---- | :---- | :---- | :---- |
| POST | `/payments` ⟳ | `{ orderId }` → `201 Payment`. The amount comes from the order (`BeginPayment`), never from the body. If the order already has a `PENDING` payment, that one is returned (`200`) — never a second checkout. `404` for an order that is not the caller's; `409 ORDER_NOT_PAYABLE` (`details.status`) unless the order is `PENDING` or `PAYMENT_FAILED` and before its deadline; `503 PAYMENT_PROVIDER_UNAVAILABLE` when Stripe cannot be reached (retry with the same key). Sequence in §6.2. | USER · `PAYMENT` |
| GET | `/payments/:id` | `Payment`. Someone else's → `404`. | USER |
| POST | `/payments/:id/fake-confirm` | `{ outcome: 'SUCCEEDED' \| 'FAILED' }` → `Payment`. Produces exactly what a Stripe webhook would (§8). **`404 ROUTE_NOT_FOUND` unless the payment's provider is `FAKE` and `NODE_ENV` is not `production`.** Not `PENDING` → `409 INVALID_STATE`. | USER · `PAYMENT` |
| POST | `/api/webhooks/stripe` *(version-neutral)* | Stripe events. The gateway passes the **raw body** and `Stripe-Signature` to `payment.WebhookService.HandleStripeEvent`; payment verifies the signature (`400 WEBHOOK_SIGNATURE_INVALID`), records the event id (a duplicate answers `200` and does nothing), and applies it in one transaction. Handled events: architecture §6. Unhandled types answer `200`. Excluded from OpenAPI. | SIGNATURE |

---

## 5. Server-sent events

[ADR 0022](./decisions/0022-order-updates-reach-browsers-as-server-sent-events.md). `text/event-stream` from the gateway, read by the web server's Route Handlers and passed through to the browser.

| Stream | Carries | Opened by |
| :---- | :---- | :---- |
| `GET /orders/:id/events` | that order's changes; ownership checked once at connect (`404` otherwise) | the confirmation / tracking page |
| `GET /staff/orders/events` | every order's changes | the staff board |

```text
event: order.status
id: <outbox event id>
data: {"orderId":"…","orderNo":1042,"status":"PREPARING","at":"2026-09-24T08:15:02.120Z"}

: ping
```

- Fed by the gateway's ephemeral consumer of `ordering.order.status_changed` (§8). A `: ping` comment every 25 s keeps proxies from closing an idle stream.
- **An event is a nudge, not the record.** On every connect and reconnect the page re-reads the order (or the board) over HTTP; a frame lost during a reconnect costs nothing but latency.
- A customer stream ends after the order reaches `COMPLETED` or `CANCELLED`.

---

## 6. Flows

### 6.1 Place an order — `POST /orders`

```text
web ──POST /orders + Idempotency-Key──▶ gateway ──PlaceOrder──▶ ordering
ordering:
  1. (user, key) exists?  same request_hash → return it (200) · different → 422 IDEMPOTENCY_KEY_REUSED
  2. orderId = newId()
  3. catalog.PriceItems(lines)                  → priced lines, or PRODUCT_UNAVAILABLE / OPTION_INVALID / OUT_OF_STOCK (read-only check)
  4. validate promo (read-only), compute totals → PROMO_CODE_INVALID / ORDER_TOTAL_TOO_LOW
  5. catalog.ReserveStock(orderId, lines)       → HELD reservations, or OUT_OF_STOCK / STOCK_CONTENDED
  6. transaction: lock + re-validate promotion, used_count + 1, insert O-1 PENDING, O-2, O-3
       on any failure from here (including P2002 on the idempotency key):
         catalog.ReleaseStock(orderId)          (best effort — the orphan sweep is the backstop)
         P2002 → return the winning order (200) · otherwise → the error
  7. 201 Order
```

### 6.2 Pay — `POST /payments`, then the webhook

```text
web ──POST /payments {orderId} + Idempotency-Key──▶ gateway ──CreatePayment──▶ payment
payment:
  1. (user, key) exists? → return it (re-reading the session's client secret from Stripe)
  2. open PENDING payment for this order? → return it (200)
  3. paymentId = newId(); ordering.BeginPayment(orderId, userId, paymentId)
       ordering: order must be the caller's, PENDING or PAYMENT_FAILED, before its deadline
                 PAYMENT_FAILED → PENDING · current_payment_id = paymentId · expires_at ≥ now + 35 min
                 → { orderNo, totalVnd }
  4. insert P-1 PENDING (amount = totalVnd)
  5. STRIPE: checkout.sessions.create(idempotencyKey = the request's key) → store session id → clientSecret
     FAKE:   nothing — the page shows the simulate buttons
  6. 201 Payment

Stripe ──webhook──▶ gateway ──raw body──▶ payment
  verify signature · insert P-3 (duplicate → 200, stop)
  checkout.session.completed (paid) → P-1 SUCCEEDED + outbox payment.payment.succeeded
ordering consumer:
  order PENDING / PAYMENT_FAILED → PAID, O-3, O-6 EARN, O-5 + outbox ordering.order.status_changed
  order CANCELLED               → outbox ordering.payment.rejected → payment refunds (ORDER_NOT_PAYABLE)
  already PAID or later         → nothing (a redelivery)
```

### 6.3 Cancel a paid order — staff

```text
staff ──POST /staff/orders/:id/cancel──▶ ordering
  transaction: PAID → CANCELLED, O-3, O-6 EARN_REVERSED, promo use −1, refund_status PENDING
               + outbox ordering.order.status_changed {from: PAID, to: CANCELLED, paymentId}
catalog consumer: reservations → RELEASED, stock returned
payment consumer: insert P-2 (UNIQUE payment_id) → Stripe refund (idempotency key = refund id)
                  → refund.updated webhook → P-2 SUCCEEDED + outbox payment.refund.succeeded
ordering consumer: refund_status → REFUNDED
```

---

## 7. Error codes

Every code is one entry in `ERRORS` in `packages/contracts`: HTTP status, gRPC status, `details` schema. A service throws `rpcError(code, details?)` and never picks a status itself.

| Code | HTTP | `details` | Raised by |
| :---- | :---- | :---- | :---- |
| `VALIDATION_FAILED` | 400 | `issues: [{ path, code }]` | gateway |
| `MALFORMED_REQUEST` | 400 | — | gateway (body is not JSON) |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | — | gateway |
| `WEBHOOK_SIGNATURE_INVALID` | 400 | — | payment |
| `UNAUTHENTICATED` | 401 | — | gateway, identity |
| `INVALID_CREDENTIALS` | 401 | — | identity |
| `FIREBASE_TOKEN_INVALID` | 401 | `reason: INVALID \| PROVIDER \| EMAIL_UNVERIFIED` | identity |
| `PERMISSION_DENIED` | 403 | `required: string[]` (not named in production) | gateway |
| `ACCOUNT_LOCKED` | 403 | `lockedUntil: string \| null` — never the reason | identity |
| `ACCOUNT_DEACTIVATED` | 403 | — | identity |
| `SELF_ACTION_FORBIDDEN` | 403 | — | identity |
| `CURRENT_PASSWORD_INCORRECT` | 403 | — | identity *(P1)* |
| `ROUTE_NOT_FOUND` | 404 | — | gateway; payment (`fake-confirm` when disabled) |
| `RESOURCE_NOT_FOUND` | 404 | `resource: USER \| CATEGORY \| PRODUCT \| TOPPING \| ORDER \| PROMOTION \| PAYMENT` | any service |
| `INVALID_STATE` | 409 | `status` — the current status | ordering, payment |
| `EMAIL_TAKEN` | 409 | — | identity |
| `LAST_ADMIN` | 409 | — | identity |
| `CATEGORY_NAME_TAKEN`, `PRODUCT_NAME_TAKEN`, `TOPPING_NAME_TAKEN` | 409 | `locale: en \| vi` — which name clashed | catalog |
| `PROMO_CODE_TAKEN` | 409 | — | ordering |
| `CATEGORY_IN_USE` | 409 | — | catalog |
| `STOCK_VERSION_CONFLICT` | 409 | `currentVersion`, `currentStockQty` | catalog |
| `OUT_OF_STOCK` | 409 | `products: [{ productId, available }]` | catalog → ordering |
| `STOCK_CONTENDED` | 409 | — | catalog → ordering |
| `ORDER_NOT_PAYABLE` | 409 | `status` | ordering → payment |
| `IDEMPOTENCY_KEY_REUSED` | 422 | — | ordering, payment |
| `PRODUCT_UNAVAILABLE` | 422 | `productIds: string[]` | catalog → ordering |
| `OPTION_INVALID` | 422 | `lineIndex`, `reason: SIZE \| TOPPING \| TOO_MANY_TOPPINGS` | catalog → ordering |
| `PROMO_CODE_INVALID` | 422 | `reason: NOT_FOUND \| INACTIVE \| NOT_STARTED \| EXPIRED \| MIN_SUBTOTAL \| EXHAUSTED \| PER_USER_LIMIT`, `minSubtotalVnd?` | ordering |
| `PROMO_MAX_USES_BELOW_USED` | 422 | `usedCount` | ordering |
| `POINTS_INSUFFICIENT` | 422 | `balance` | ordering *(P1)* |
| `ORDER_TOTAL_TOO_LOW` | 422 | `minimumVnd` | ordering |
| `IMAGE_INVALID` | 422 | `reason: TYPE \| SIZE` | gateway, catalog |
| `RESOURCE_REFERENCE_INVALID` | 422 | `field` | catalog |
| `RATE_LIMITED` | 429 | `retryAfterSeconds` | gateway |
| `INTERNAL` | 500 | — | any |
| `UPSTREAM_UNAVAILABLE` | 503 | — | gateway |
| `PAYMENT_PROVIDER_UNAVAILABLE` | 503 | — | payment |
| `UPSTREAM_TIMEOUT` | 504 | — | gateway |

---

## 8. JetStream events

Every subject is declared with its zod payload schema in `packages/contracts/src/events/` — **a subject not declared there does not exist.** Every publish goes through the outbox (rdm-spec §2.7); every consumer is idempotent by its own write (rdm-spec §1.2). Every payload carries `eventId` (the outbox id) and `occurredAt`.

Streams: `ORDERING` (`ordering.>`), `PAYMENT` (`payment.>`), 7 days, 2-minute duplicate window; `DLQ` (`dlq.>`), 30 days. Durable consumers are named `<service>-<subject with dots as dashes>` (`catalog-ordering-order-status_changed`), with `max_deliver: 10`; a message that can never succeed is copied to `dlq.<service>.<consumer>` and terminated.

| Subject | Publisher | Payload (besides `eventId`, `occurredAt`) | Consumers → effect |
| :---- | :---- | :---- | :---- |
| `ordering.order.status_changed` | ordering | `orderId, orderNo, userId, from, to, actorType, paymentId?, cancelReason?` — one event per transition | catalog → `to: PAID` confirms reservations, `to: CANCELLED` releases them · payment → `from: PAID, to: CANCELLED` refunds `paymentId` (`STAFF_CANCELLED`) · gateway → SSE frame (ephemeral) |
| `ordering.payment.rejected` | ordering | `orderId, paymentId, orderStatus` — a payment succeeded for an order that was no longer payable | payment → refund (`ORDER_NOT_PAYABLE`) |
| `payment.payment.succeeded` | payment | `paymentId, orderId, userId, amountVnd, method` | ordering → `PAID` (§6.2), or `ordering.payment.rejected` |
| `payment.payment.failed` | payment | `paymentId, orderId, reason: ASYNC_FAILED \| EXPIRED \| SIMULATED` | ordering → `PAYMENT_FAILED`, only if the order is `PENDING` and `current_payment_id = paymentId` |
| `payment.refund.succeeded` | payment | `refundId, paymentId, orderId, amountVnd` | ordering → `refund_status: REFUNDED` |
| `payment.refund.failed` | payment | `refundId, paymentId, orderId` | ordering → `refund_status: FAILED` (an admin resolves it in Stripe) |

**Ordering:** within one aggregate the outbox publishes in `id` order, but consumers never rely on it. Every effect is a conditional update on the current status, so an old event arriving late changes nothing.

---

## 9. Service ownership and internal RPCs

### 9.1 Route ownership

The gateway routes by path prefix; **a prefix belongs to exactly one service.**

| Route prefixes | Service |
| :---- | :---- |
| `/auth`, `/users/me`, `/admin/users` | `identity` |
| `/categories`, `/products`, `/staff/products`, `/staff/toppings`, `/admin/categories`, `/admin/products`, `/admin/toppings` | `catalog` |
| `/orders`, `/staff/orders`, `/admin/orders`, `/admin/reports`, `/admin/promotions`, `/loyalty` | `ordering` |
| `/payments`, `/webhooks/stripe` | `payment` |
| `/health`, `/version`, `/docs` | `gateway` |

**Composed response:** `GET /admin/orders/:id` (ordering + payment) is the only route that calls two services, and it degrades as §3.4 says.

### 9.2 Internal RPCs

gRPC packages are `brewlite.<service>`; protos in `packages/contracts/proto/brewlite/<service>/`. Gateway→service RPCs mirror the routes above and are not repeated. **These are the service→service calls:**

| RPC | Caller | Why synchronous | If it fails |
| :---- | :---- | :---- | :---- |
| `catalog.MenuService.PriceItems(lines)` | ordering (quote, place) | an order cannot exist without authoritative prices | refuse the request (`503`) |
| `catalog.StockService.ReserveStock(orderId, lines)` | ordering (place) | the customer must know now whether it is in stock | refuse the order (`503`), then `ReleaseStock` in case the reservation did commit |
| `catalog.StockService.ReleaseStock(orderId)` | ordering (compensation only) | undo a reservation whose order was never written | log; the orphan sweep releases it later |
| `ordering.OrderService.BeginPayment(orderId, userId, paymentId)` | payment | the amount and the payability must be current | refuse the payment (`503`); no payment row is written |
| `ordering.OrderService.GetOrderStatus(orderId)` | catalog (orphan sweep) | the sweep must not guess | skip the row; the next run retries |
| `payment.PaymentService.ListPaymentsForOrder(orderId)` | gateway (composition, §3.4) | — | `payments: null`, `meta.degraded` |

`PriceItems` also runs a read-only `OUT_OF_STOCK` check (summed per counted product across the caller's lines) so the quote can refuse early — the reservation in `ReserveStock` stays the authority, since stock can change between the two calls. It returns every field O-2 snapshots — both product and topping names, base price, size delta, unit price — so ordering never reads catalog again to build an order line (rdm-spec §1.4).

Every call has a **2 s deadline** and goes through `BaseGrpcClient` (development-conventions §5.2).

---

## 10. Permission registry

The codes are `PERMISSIONS` in `packages/contracts`, and `ROLE_PERMISSIONS` maps each role to its set — both in code, never in the database ([ADR 0016](./decisions/0016-three-fixed-roles-and-a-compile-time-permission-catalogue.md)). Format `target.action`.

```text
menu.manage          stock.update
order.board.read     order.status.update     order.cancel.paid     order.read.all
promotion.manage     user.manage             report.read
```

| Role | Grants |
| :---- | :---- |
| `CUSTOMER` | none — every customer route is `USER` plus an ownership check |
| `STAFF` | `stock.update`, `order.board.read`, `order.status.update`, `order.cancel.paid` |
| `ADMIN` | every code |

**Adding a permission** is: the code in `PERMISSIONS`, its grants in `ROLE_PERMISSIONS`, `@RequirePermission` on the route, and this section — one PR.

---

## 11. Operational endpoints

Every service serves these — backend services on `OPS_PORT`, the gateway on its own port, **unprefixed and unwrapped**.

| Method | Path | Description | Auth |
| :---- | :---- | :---- | :---- |
| GET | `/health` | Liveness: the process is up. | PUBLIC |
| GET | `/health/ready` | Readiness: **this service's own** dependencies — its database, Redis, NATS. Never a gRPC peer. Only a dependency the service cannot serve without — catalog's menu reads survive Redis being down (architecture §2.6), so Redis joins catalog's readiness only once a background job needs it. The gateway declares no readiness dependency yet: its `RateLimitGuard` fails open on a Redis outage (architecture §2.6, §5), so Redis is not required to serve. | PUBLIC |
| GET | `/version` | `{ service, version, gitSha, builtAt }`. | PUBLIC |
| GET | `/docs`, `/docs-json` | Swagger UI and the OpenAPI document. Gateway only; `SWAGGER_ENABLED=false` in production. | PUBLIC |

---

## 12. Phase map

| Phase | Sections |
| :---- | :---- |
| **A — backend (P0)** | §0 · §1.1, §1.2 (not the password route), §1.3 · §2 · §3.1–3.3, §3.5, §3.6 · §4 · §5 · §6 · §7 · §8 · §9 (not `ListPaymentsForOrder`) · §10 · §11 |
| **B — frontend** | consumes Phase A through the generated client; no new routes |
| **C — handover** | no new routes; the Compose `apps` profile runs everything, the README, the J1 demo |
| **P1** | `PATCH /users/me/password` · §3.4 admin orders and reports · `pointsToRedeem` on quote and order · `ListPaymentsForOrder` |

---

## 13. Open decisions

**None open.** New questions are added here, numbered, and removed when an ADR resolves them.
