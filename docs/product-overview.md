# Product Overview — BrewLite

**Audience:** everyone on the team — developers, the Product Owner, the Scrum Master.

**Purpose:** answer one question — *what software are we actually building?*

**Companion docs:** [`architecture-and-tech-stack.md`](./architecture-and-tech-stack.md) answers *what do I need to know before I write code?*; [`decisions/`](./decisions/) records *why*, one decision per file. Read this file first.

This document describes the product as it is intended to be. Where a choice was contested, the reasoning lives in an ADR and is cited inline rather than re-argued here.

---

## Table of contents

1. [In one paragraph](#1-in-one-paragraph)
2. [Actors](#2-actors)
3. [Product surfaces](#3-product-surfaces)
4. [Domain glossary](#4-domain-glossary)
5. [Feature catalogue](#5-feature-catalogue)
6. [Business rules](#6-business-rules)
7. [Key user journeys](#7-key-user-journeys)
8. [Behavioural constants](#8-behavioural-constants)
9. [Non-functional requirements](#9-non-functional-requirements)
10. [Service decomposition](#10-service-decomposition)
11. [Scope, phasing and the course backlog](#11-scope-phasing-and-the-course-backlog)
12. [Risks](#12-risks)

---

## 1. In one paragraph

> *"BrewLite helps customers order and pay for drinks **cashless** in a few taps, cutting the queue and getting the order ready fast at the counter."* — the Product Vision.

A customer opens BrewLite in a browser — in English by default, or Vietnamese — and, **without an account**, browses the menu, picks a drink with a size and toppings, and adds it to a cart. Only at checkout do they sign in (email and password, or Google / Apple); then they pay by card or wallet through Stripe. They get an order number such as **#1042** and watch its status change live — *paid → preparing → ready* — then collect it at the counter. Behind the counter, **staff** work a live order board and mark drinks sold out; an **admin** manages the menu, promotions and user roles. Everything runs in **one web app** whose pages are gated by role, over a small set of backend services.

**The vision is the scope filter.** A feature that does not make ordering-and-paying faster, or the counter faster, is out. Section 11 lists what that excludes.

**What it is:**

- A cashless, pickup-at-the-counter ordering app for **one store** ([ADR 0001](./decisions/0001-one-store-with-pickup-at-the-counter.md)).
- A live order board for the people making the drinks.
- A small back office: menu, stock, promotions, roles, sales.

**What it is not:** delivery, table service, a multi-store chain, a marketplace, a loyalty programme with tiers and campaigns, a POS for cash sales, or a native mobile app.

---

## 2. Actors

| # | Actor | Auth | Surface | Cares about |
| :---- | :---- | :---- | :---- | :---- |
| **A1** | **Guest** | none | Customer pages | Seeing the menu and prices, building a cart, before committing to an account. |
| **A2** | **Customer** | account (`CUSTOMER`) | Customer pages | Ordering in a few taps, paying without cash, knowing when the drink is ready, points for coming back. |
| **A3** | **Staff** (counter / barista) | account (`STAFF`) | Staff pages | A clear queue of paid orders, moving them along with one tap, marking what has run out. |
| **A4** | **Admin** (store manager) | account (`ADMIN`) | Admin pages | The menu is right, promotions work, the right people have the right role, how sales are going. |
| **A5** | **Payment provider** | webhook signature | — | Stripe, reporting payment outcomes ([ADR 0017](./decisions/0017-stripe-checkout-is-the-payment-surface.md)). |
| **A6** | **System** | service credentials | — | Scheduled work: expiring unpaid orders, releasing their stock. |

**The course roles map onto these, not onto new actors.** The Product Owner is the store manager (A4) when accepting an increment; the lecturer accepts the whole product at the final Sprint Review.

**Roles are fixed.** `CUSTOMER`, `STAFF`, `ADMIN` — one per account, changed only by an admin. There is no role editor: three roles are the whole organisation of one coffee shop ([ADR 0016](./decisions/0016-three-fixed-roles-and-a-compile-time-permission-catalogue.md)). A guest becomes a customer by registering; a customer becomes staff when an admin says so.

---

## 3. Product surfaces

**One Next.js app, three areas, route-level RBAC** ([ADR 0014](./decisions/0014-the-web-server-is-the-gateways-only-client.md)). Mobile-first layout — most customers order on a phone — but it is a website, not an installed app.

### 3.1 Customer pages (A1, A2) — the product

The five screens of the course wireframe, plus what a returning customer needs:

| Route | Screen | Guest? |
| :---- | :---- | :---- |
| `/` | **Menu** — grid by category, name, price, image, *sold out* badge, cart badge with item count | yes |
| `/products/[id]` | **Product detail** — size S/M/L, toppings, quantity, live price, *Add to cart* | yes |
| `/cart` | **Cart** — edit quantity, remove, preview total, *Checkout* | yes |
| `/checkout` | **Checkout** — server-priced summary, promo code, pay with card or wallet | sign-in required — a guest is sent to `/login?next=/checkout` and comes back with the cart intact |
| `/orders/[id]` | **Confirmation and tracking** — order number, status, live updates, *collect at the counter* | owner only |
| `/orders` | **Order history** | signed in |
| `/account` | Profile, loyalty points | signed in |
| `/login`, `/register` | Email + password, *Continue with Google*, *Continue with Apple* | yes |

Every page's header carries the **language switch** (EN / VI), the cart badge, and — for a guest — *Sign in*. The rule for guests is §6.8.

### 3.2 Staff pages (A3)

| Route | Screen |
| :---- | :---- |
| `/staff` | **Order board** — three live columns: *Paid* → *Preparing* → *Ready*; one tap moves an order forward; cancel-with-refund on a paid order |
| `/staff/products` | Sold-out toggle and stock count per product |

### 3.3 Admin pages (A4)

| Route | Screen |
| :---- | :---- |
| `/admin` | Dashboard — today's orders and revenue *(P1)* |
| `/admin/products`, `/admin/categories`, `/admin/toppings` | Menu CRUD, sizes and allowed toppings per product, image upload |
| `/admin/promotions` | Promo codes |
| `/admin/orders` | Every order, filterable |
| `/admin/users` | Users, role changes, lock / unlock |

An admin can open the staff pages too. A staff member cannot open the admin pages.

---

## 4. Domain glossary

Use these words in code, tickets and commit messages.

| Term | Meaning |
| :---- | :---- |
| **Guest** | Someone using BrewLite without signing in. May browse and build a cart; may not order (§6.8, [ADR 0029](./decisions/0029-guests-browse-and-build-a-cart-and-sign-in-only-to-order.md)). |
| **Locale** | The UI language: `en` (default) or `vi`. Money is always đồng, whatever the locale ([ADR 0028](./decisions/0028-the-ui-speaks-english-and-vietnamese-through-i18next.md)). |
| **Soft delete** | Removing a row from use by stamping `deleted_at` and `deleted_by_id` instead of deleting it; an admin can restore it (§6.9, [ADR 0030](./decisions/0030-rows-others-cite-are-soft-deleted-and-accounts-are-locked-or-deactivated.md)). |
| **Lock** / **Deactivate** | Two ways an admin stops an account signing in: a **lock** is temporary or investigative, with a reason and an optional end; **deactivation** is a soft delete of the account. Both are reversible. |
| **Product** | A drink (or snack) on the menu. Has a base price, a category, allowed sizes and allowed toppings. |
| **Category** | A menu section — *Cà phê*, *Trà*, *Đá xay*. |
| **Size** | `S`, `M` or `L`. Each product offers a subset, each with a price delta over the base price. |
| **Topping** | An add-on with its own price — *Trân châu*, *Kem cheese*. A product lists which ones it allows. |
| **Line** | One cart or order row: product + size + toppings + quantity. Two cups of the same drink with different toppings are two lines. |
| **Unit price** | Base price + size delta + sum of topping prices. **Line total** = unit price × quantity. |
| **Cart** | The lines a customer is building. **Client state only**, until it becomes an order ([ADR 0015](./decisions/0015-nextjs-server-features-replace-client-data-libraries.md)). |
| **Quote** | The server's authoritative pricing of a cart — lines, discount, total — without creating anything. |
| **Order** | A cart committed by a signed-in customer, priced by the server, with stock reserved. Starts `PENDING`. |
| **Order number** | The short number people read and say — `#1042`. Not the order's id ([ADR 0009](./decisions/0009-every-identifier-is-a-uuidv7.md)). |
| **Order status** | The state machine in §6.4. |
| **Payment** | One attempt to pay one order. An order can have several (a failed one, then a successful one), never two open at once. |
| **Stock** | How many of a product can still be sold. Optional per product — most drinks are not counted; a limited cold brew is. |
| **Reservation** | Stock set aside for an order between placing and paying; released if the order is cancelled ([ADR 0018](./decisions/0018-stock-is-reserved-at-order-creation-under-optimistic-locking.md)). |
| **Sold out** | A product staff switched off for now. Different from stock reaching zero, which sells it out automatically. |
| **Promotion** / **promo code** | A discount a customer types at checkout — `WELCOME10`. |
| **Loyalty points** | Earned when an order is paid; spent as a discount *(P1)* ([ADR 0021](./decisions/0021-promotions-and-loyalty-live-in-the-ordering-service.md)). |
| **Idempotency key** | A client-generated UUIDv7 that makes a retried *place order* or *pay* request harmless ([ADR 0020](./decisions/0020-idempotency-keys-are-enforced-by-a-unique-constraint.md)). |
| **Order board** | The staff page listing paid, preparing and ready orders, live. |

---

## 5. Feature catalogue

**P0** = the MVP, must exist for the final demo. **P1** = complete product, build after P0 is green. **P2** = stretch; only if time is left.

### F1 — Menu (P0)

- Menu grid by category: image, name, price from (the smallest size), *sold out* badge. Loading and empty states.
- Product detail: description, size picker (only offered sizes), topping picker (only allowed toppings, at most `MAX_TOPPINGS_PER_LINE`), quantity, price recalculated live on every choice.
- A product that is sold out, deleted, or out of stock cannot be added.
- **No account needed:** every menu page works for a guest.
- *(P1)* Search by name.

**Acceptance:** the menu renders from the API with 30 products in under 1 s on a mid-range phone; a sold-out product shows its badge and a disabled *Add to cart*.

### F2 — Cart (P0)

- Add, change quantity, remove; total recalculated on every change; item-count badge on every customer page.
- **Works for a guest.** The cart lives in the browser, so building one needs no account and no server call.
- Survives a page reload and a sign-in (browser storage), and **survives a failed payment** — the cart is cleared only after the order is paid.
- Prices shown in the cart are a preview; the server re-prices at checkout and the checkout page shows the server's numbers.

**Acceptance:** a cart with a product that became sold out since it was added shows that line as unavailable at checkout, and the customer can remove it and continue.

### F3 — Accounts and sign-in (P0)

- Register with email + password; sign in with email + password.
- *Continue with Google* (P0) and *Continue with Apple* (P1 — needs a paid Apple developer account, §12) through Firebase Authentication, exchanged for a BrewLite session ([ADR 0013](./decisions/0013-identity-issues-brewlite-tokens-and-firebase-only-proves-sign-ins.md)).
- Sessions: short access token, long-lived refresh token, sign-out. The session stays alive across the Stripe payment round trip.
- Guests browse and build a cart; checkout, orders and account pages require sign-in, and sign-in returns the customer to where they were with the cart intact (§6.8).
- A locked or deactivated account cannot sign in (§6.9).
- *(P1)* Change password; *(P2)* forgot password by email.

### F4 — Checkout and orders (P0)

- Checkout shows the server's quote: lines, subtotal, discount, total, and any line that can no longer be sold.
- Placing the order creates it `PENDING`, reserves stock, and returns the order number. A retried *place order* with the same idempotency key returns the same order — never a second one.
- The customer can cancel an order they have not paid.
- An order that is not paid within `ORDER_UNPAID_TTL_MS` is cancelled automatically and its stock released.

### F5 — Cashless payment (P0)

- The customer pays by **card or wallet** (Google Pay, Apple Pay, Link — whatever Stripe offers on that device) in an embedded Stripe Checkout on the checkout page ([ADR 0017](./decisions/0017-stripe-checkout-is-the-payment-surface.md)).
- Success → order `PAID`, confirmation screen with the order number, cart cleared.
- Failure or abandonment → order `PAYMENT_FAILED`, cart kept, *Try again* starts a new payment for the same order.
- A retried *pay* request with the same idempotency key never charges twice.
- **The order is marked paid by Stripe's webhook, never by the browser returning.** A customer who pays and closes the tab still gets a paid order.
- A **fake payment provider** replaces Stripe in tests and in offline demos: *Simulate success* / *Simulate failure*.

### F6 — Order tracking and history (P0)

- Confirmation screen: order number, status, total, *please collect at the counter*.
- Status updates live, without reloading, until `COMPLETED` or `CANCELLED` ([ADR 0022](./decisions/0022-order-updates-reach-browsers-as-server-sent-events.md)).
- Order history, newest first, with each order's lines and status.

### F7 — Staff order board (P0)

- Live board of `PAID`, `PREPARING` and `READY` orders, oldest first, each with its lines, toppings and note.
- One tap moves an order `PAID → PREPARING → READY → COMPLETED`. Any other move is refused.
- Cancel a paid order (e.g. an ingredient ran out) with a reason; the customer is refunded automatically.
- Sold-out toggle and stock count per product.

### F8 — Admin back office (P0 menu and roles; P1 the rest)

- **(P0)** Products, categories, toppings: create, edit, delete and restore (soft delete, §6.9); sizes and allowed toppings per product; image upload.
- **(P0)** Users: list, search, change role, lock (with a reason, optionally until a date) / unlock, deactivate / restore. Nobody can do any of these to the last active admin, or to themselves.
- **(P0)** Promotions: create, edit, switch off, delete and restore (§6.5).
- *(P1)* All orders with filters; dashboard with today's orders, revenue and top products.

### F9 — Promotions and loyalty (P0 promotions and earning; P1 redeeming)

- Promo codes applied at checkout, validated by the server (§6.5).
- Points earned automatically when an order is paid, reversed if that order is refunded (§6.6).
- *(P1)* Spend points as a discount at checkout.

### F10 — Backend business rules (P0 — course Task 10)

Graded on its own, with tests as the evidence:

1. **Order state machine** — illegal transitions are refused (§6.4).
2. **Idempotent payment** — the same `Idempotency-Key` twice creates one order and one charge (§6.7).
3. **Concurrent stock control** — many customers ordering the last units at once never oversell (§6.3).
4. **Promotions and loyalty** — a valid code discounts; points are credited after `PAID` (§6.5, §6.6).

### F11 — Language (P0)

- The whole UI — labels, messages, errors — in **English (default)** and **Vietnamese**, switched from any page's header.
- A guest's choice is remembered in the browser; a signed-in customer's choice is saved to their account and follows them to another device.
- Money is always shown in đồng, formatted for the locale — `₫123,000` in English, `123.000 ₫` in Vietnamese. Dates and times are always shown in Vietnam time.
- **Menu content is bilingual too** ([ADR 0031](./decisions/0031-menu-content-is-written-in-english-and-vietnamese.md)): every category, product and topping name, and every product description, is entered by the admin in both English and Vietnamese, and the customer reads the one matching their language. The admin forms refuse a missing language.

**Acceptance:** switching language on the checkout page re-renders every label and error in the other language without losing the cart or the entered promo code.

---

## 6. Business rules

### 6.1 Money

Every amount is an **integer number of Vietnamese đồng**, in every layer — database, API, events, Stripe ([ADR 0002](./decisions/0002-every-amount-is-an-integer-number-of-dong.md)). VND has no minor unit, so there are no cents and no floats anywhere. Prices include VAT; BrewLite computes no tax.

### 6.2 Pricing

```text
unit price  = product base price + size delta + Σ topping prices
line total  = unit price × quantity
subtotal    = Σ line totals
discount    = promotion discount (§6.5) + points discount (§6.6, P1)
total       = subtotal − discount          (never below MIN_PAYABLE_VND)
```

- **The server prices every order.** The client's numbers are a preview; an amount sent by a client is never read.
- An order line **snapshots** the product name (in both languages), size, toppings and prices at the moment of ordering. A later menu price change never re-prices an existing order.

### 6.3 Stock

- A product's stock is **optional**: `null` means not counted (most drinks), a number means "this many can still be sold".
- Placing an order **reserves** the counted stock of each line inside one transaction, under **optimistic locking**; if any line cannot be reserved, nothing is reserved and the order is refused with the products that ran short ([ADR 0018](./decisions/0018-stock-is-reserved-at-order-creation-under-optimistic-locking.md)).
- Paying confirms the reservation. Cancelling — by the customer, by staff, or by expiry — releases it.
- Stock reaching zero sells the product out automatically; the *sold out* toggle is separate and is staff's manual switch.
- Toppings are not counted — a topping that ran out is switched off.

### 6.4 Order state machine

[ADR 0019](./decisions/0019-order-status-changes-only-through-the-state-machine.md). Every move not listed is refused with `409 INVALID_STATE`. `COMPLETED` and `CANCELLED` are terminal.

```text
start ─▶ PENDING ──payment ok──▶ PAID ──staff──▶ PREPARING ──staff──▶ READY ──staff──▶ COMPLETED
           │  ▲                    │
  payment  │  │ customer           │ staff (refund)
   failed  ▼  │ retries            ▼
        PAYMENT_FAILED ──────▶ CANCELLED ◀── PENDING (customer / expiry)
```

| From | To | Who | When |
| :---- | :---- | :---- | :---- |
| `PENDING` | `PAID` | payment | Stripe (or the fake provider) reports success |
| `PENDING` | `PAYMENT_FAILED` | payment | the payment failed or its checkout expired |
| `PAYMENT_FAILED` | `PENDING` | customer | starts a new payment |
| `PENDING`, `PAYMENT_FAILED` | `CANCELLED` | customer, system | customer cancels; or unpaid past its deadline |
| `PAID` | `PREPARING` | staff | starts making it |
| `PAID` | `CANCELLED` | staff | can't make it — **refunded automatically**, points reversed |
| `PREPARING` | `READY` | staff | made |
| `READY` | `COMPLETED` | staff | handed over |

- A `PREPARING` order cannot be cancelled — the drink is being made.
- A customer cannot cancel a paid order themselves; they ask at the counter.
- Every transition is recorded with who made it and when, which is what the tracking page shows.
- **Late payment on a cancelled order:** if a payment succeeds after its order was cancelled (it expired in the same minute), the order stays `CANCELLED` and the payment is refunded automatically.

### 6.5 Promotions

A promo code is:

- **Percent** (e.g. 10%, optionally capped at a maximum discount) or **fixed** (e.g. 15,000₫ off);
- valid in a time window, with an optional minimum subtotal, an optional total-uses cap, and a per-customer limit (default 1);
- case-insensitive when typed, stored upper-case.

Rules:

- **One code per order.** The discount is capped at `subtotal − MIN_PAYABLE_VND`, so a valid code never drops the total below `MIN_PAYABLE_VND` — the customer pays the minimum rather than being refused. A cart whose **subtotal** is already below `MIN_PAYABLE_VND` is refused `ORDER_TOTAL_TOO_LOW`, code or not.
- Percent discounts round **down** to the đồng.
- A use is counted when the order is **placed** and given back if the order is **cancelled** — so a cap of 100 can never be exceeded by 100 unpaid orders plus one paid one.
- An invalid code refuses the quote or the order with a reason the UI can show: not found, not active, not started, expired, below the minimum, exhausted, or already used by this customer.

### 6.6 Loyalty points

- **Earn** `floor(total / LOYALTY_EARN_STEP_VND)` points when an order becomes `PAID` — 1 point per 10,000₫ paid. Credited in the same transaction as the status change, exactly once per order.
- **Reverse** those points if a paid order is cancelled and refunded.
- *(P1)* **Redeem** at checkout: 1 point = `LOYALTY_POINT_VALUE_VND` off, at most `LOYALTY_MAX_REDEEM_PERCENT` of the subtotal. Redeemed points are returned if the order is cancelled.
- A balance never goes negative. There are no tiers, no expiry, no campaigns.

### 6.7 Idempotency

- *Place order* and *pay* require an `Idempotency-Key` header — a UUIDv7 the client generates once per user intent (one tap of the button) and reuses on every retry of that intent.
- The same key with the same body returns the original result. The same key with a different body is refused (`422 IDEMPOTENCY_KEY_REUSED`).
- The guarantee is a **database unique constraint**, so it holds across retries, replicas and restarts ([ADR 0020](./decisions/0020-idempotency-keys-are-enforced-by-a-unique-constraint.md)).
- Stripe receives the same key, so Stripe also never creates two checkouts for one intent.

### 6.8 Guests and sign-in

[ADR 0029](./decisions/0029-guests-browse-and-build-a-cart-and-sign-in-only-to-order.md). **Browse and build a cart freely; sign in to order.**

| A guest may | A guest may not |
| :---- | :---- |
| see the menu, categories and product details; add, edit and remove cart lines; see the cart's preview total; switch language; register or sign in | open checkout, apply a promo code, place an order, pay, see orders or points |

- **The cart belongs to the browser, not to an account.** It is kept in browser storage, so it survives reloads and the sign-in round trip — a guest who signs in at checkout lands back on checkout with the same cart.
- **Sign-in is asked for at the last responsible moment:** the *Checkout* button. A guest who opens `/checkout`, `/orders` or `/account` is sent to sign in and then returned to the page they asked for (`?next=`, a relative path only — never an absolute URL, so the link cannot bounce anyone to another site).
- **Why no guest checkout:** an order needs an owner — to track it, to find it in history, to credit points, to scope its idempotency key, and to guard the order routes as the course's Task 7 requires. Signing in with Google is one tap, which keeps the cost low.
- **Signing out clears the cart**, so the next person on a shared device does not inherit it. Signing *in* never clears it.
- A guest's prices are a preview; the server's quote at checkout is the truth (§6.2).

### 6.9 Deletion and locking

[ADR 0030](./decisions/0030-rows-others-cite-are-soft-deleted-and-accounts-are-locked-or-deactivated.md). Nothing that an order, a payment or another row points at is ever removed.

- **Soft delete.** Deleting a user, category, product, topping or promotion stamps *when* (`deleted_at`) and *by whom* (`deleted_by_id`). The row disappears from the menu and from every list, keeps every column, and an admin can **restore** it. Orders, payments, refunds and loyalty history are never deleted at all.
- **Deleting a category** is refused while it still has products that are not deleted.
- **Locking an account** needs a **reason** (seen by admins only) and may carry an **end date**; with no end date it lasts until an admin unlocks it. A lock whose end date has passed lifts itself the next time the account signs in or refreshes.
- **Deactivating an account** is its soft delete: for a barista who left, or an account that must stop for good. The email stays reserved, so restoring always works.
- Locking or deactivating signs the account out everywhere (the access token already issued lapses within 15 minutes).
- **The last active admin** — not deleted, not locked — cannot be demoted, locked or deactivated, and nobody can do any of these to themselves.
- Self-service account deletion (a customer erasing their own data) is out of scope (§11.4).

---

## 7. Key user journeys

### J1 — The happy path (the demo)

The flow from the course brief, end to end:

1. Customer opens BrewLite as a guest → menu, in English (they could switch to Vietnamese).
2. Taps *Cappuccino* → picks **M**, adds *Kem cheese* → price updates → *Add to cart*. Cart badge shows **1**.
3. Adds *Trà đào L × 2*. Opens the cart: total **123,000₫**.
4. *Checkout* → still a guest → sent to sign in → signs in with Google → back on checkout, same cart.
5. Checkout shows the server's quote. Types `WELCOME10` → discount applied.
6. *Place order* → order **#1042**, `PENDING`, stock reserved.
7. Pays with a card in the embedded Stripe form.
8. Stripe's webhook arrives → order `PAID`, points credited → confirmation screen: *#1042 · PAID · please collect at the counter*. Cart cleared.
9. On the staff board, #1042 appears in *Paid*. Staff taps → `PREPARING` → `READY`. The customer's screen follows live.
10. Customer collects; staff taps → `COMPLETED`.

### J2 — Payment fails

1. At step 7 the card is declined, or the customer closes the payment form and it expires.
2. Order → `PAYMENT_FAILED`. The cart is untouched.
3. *Try again* → a new payment for the same order → `PENDING` → pays → J1 step 8.
4. If they never come back, the order is cancelled at its deadline and its stock returns to the menu.

### J3 — A double tap

1. The customer taps *Place order*, the network stalls, they tap again.
2. Both requests carry the same idempotency key → one order, one reservation, one order number.
3. Same for *Pay*: one Stripe checkout, one charge.

### J4 — The last cold brew

1. *Cold Brew* has stock **1**. Two customers place orders at the same second.
2. One order is created; the other is refused `409 OUT_OF_STOCK` naming *Cold Brew*, and nothing else of that order was reserved.
3. The menu now shows *Cold Brew* as sold out.

### J5 — Staff can't make a paid order

1. An order is `PAID`, but the milk ran out.
2. Staff cancels it with a reason → `CANCELLED`, stock released, points reversed, full refund issued through Stripe.
3. The customer's tracking page shows *Cancelled — refunded* with the reason.

### J6 — Admin sets up a promotion and a new barista

1. Admin creates `SUMMER15`: 15% off, capped at 20,000₫, minimum 50,000₫, 200 uses, one per customer, valid for June.
2. A new barista registers a normal account; admin finds them in *Users* and changes their role to `STAFF`. Their next sign-in opens the staff board.

---

## 8. Behavioural constants

Product decisions, not implementation details. Each is one constant in `packages/contracts`, named here so code and docs agree.

| Constant | Value | Why |
| :---- | :---- | :---- |
| `ORDER_UNPAID_TTL_MS` | 15 min | Holds reserved stock long enough to pay, not long enough to starve the menu. |
| `PAYMENT_WINDOW_MS` | 35 min | Starting a payment extends the order's deadline to now + 35 min: Stripe Checkout sessions last at least 30 min, and the order must outlive its session. |
| `CHECKOUT_SESSION_TTL_MS` | 30 min | Stripe's minimum session lifetime. |
| `RESERVATION_ORPHAN_TTL_MS` | 3 h | A reservation whose order was never written is released after this — longer than any order can stay unpaid. |
| `MAX_LINES_PER_ORDER` | 20 | A coffee order, not a catering order. |
| `MAX_QTY_PER_LINE` | 10 | Same. |
| `MAX_TOPPINGS_PER_LINE` | 3 | A drink, not a sundae. |
| `ORDER_NOTE_MAX_LENGTH` | 200 chars | "Ít đá, ít ngọt" fits. |
| `MIN_PAYABLE_VND` | 10,000₫ | No free or near-free charges after discounts; also above Stripe's minimum charge (to verify, §12). |
| `MAX_ORDER_TOTAL_VND` | 5,000,000₫ | A café order above this is a mistake or abuse, not a real cart; also keeps the total well under the `INT` column's overflow point. |
| `LOYALTY_EARN_STEP_VND` | 10,000₫ | 1 point per 10,000₫ paid. |
| `LOYALTY_POINT_VALUE_VND` | 1,000₫ | *(P1)* 1 point = 1,000₫ off — 10% back. |
| `LOYALTY_MAX_REDEEM_PERCENT` | 50% | *(P1)* Points pay at most half an order. |
| `ACCESS_TOKEN_TTL_MS` | 15 min | Short enough that a role change or lock bites fast. |
| `REFRESH_TOKEN_TTL_MS` | 30 days | A regular customer should not sign in weekly. |
| `MENU_CACHE_TTL_MS` | 5 min | Backstop only — every menu write invalidates at once. |
| `PRODUCT_IMAGE_MAX_BYTES` | 2 MB | JPEG, PNG or WebP. |
| `STAFF_BOARD_STATUSES` | `PAID`, `PREPARING`, `READY` | What the counter works on. |
| `SUPPORTED_LOCALES` / `DEFAULT_LOCALE` | `en`, `vi` / `en` | §F11. |
| `LOCK_REASON_MAX_LENGTH` | 255 chars | A sentence for the next admin, not an essay. |
| `MAX_LOCK_DURATION_DAYS` | 365 | A longer lock is a deactivation. |

Seed defaults (data, editable by an admin, not constants): sizes **S +0₫, M +6,000₫, L +10,000₫**.

---

## 9. Non-functional requirements

From the course brief, made measurable.

### Performance

- API response **p95 < 500 ms** on seed data, measured at the gateway for every P0 route.
- Menu first render **< 1 s** on a mid-range phone on 4G.

### Security

- Passwords hashed with **bcrypt** ([ADR 0013](./decisions/0013-identity-issues-brewlite-tokens-and-firebase-only-proves-sign-ins.md)); JWT access tokens; refresh tokens stored only as hashes.
- Every input validated at the edge with zod; unknown fields refused.
- Tokens never reach browser JavaScript — `httpOnly` cookies only ([ADR 0014](./decisions/0014-the-web-server-is-the-gateways-only-client.md)).
- Role and ownership checked on every route; another customer's order answers `404`, never `403`.
- Stripe secrets never reach the client; webhooks are signature-verified.
- Rate limits on sign-in, registration and payment routes.

**Internationalisation** — English and Vietnamese are complete: every UI string in both, checked by a test. Servers send codes, never sentences, so a new language touches only the web app.

**Compatibility** — current Chrome, Safari, Firefox and Edge; phone, tablet and desktop widths.

**Accessibility** — every control labelled, keyboard reachable, WCAG AA contrast; status is never shown by colour alone.

**Operability** — the whole stack starts with one `docker compose up`; every service answers `/health` and `/health/ready`.

---

## 10. Service decomposition

Capability → owning service. Detail in [`architecture-and-tech-stack.md`](./architecture-and-tech-stack.md) §2 ([ADR 0004](./decisions/0004-the-backend-is-a-gateway-plus-four-domain-services.md)).

| Service | Owns |
| :---- | :---- |
| **gateway** | The only public HTTP API: auth verification, role checks, validation, rate limits, OpenAPI, the SSE stream, the Stripe webhook entry. No database. |
| **identity** | Users, passwords, Firebase sign-in exchange, sessions and tokens, roles. |
| **catalog** | Categories, products, sizes, toppings, images, availability, stock and reservations. |
| **ordering** | Quotes, orders, the order state machine, promotions, loyalty points. |
| **payment** | Payments, Stripe Checkout, webhooks, refunds. |

**Interactions that must exist:**

- ordering → catalog: *price these lines* and *reserve this stock* — **synchronous**, the order cannot be created without the answer.
- payment → ordering: *may this order be paid, and for how much?* — **synchronous**.
- payment → ordering: *this payment succeeded / failed* — **event**.
- ordering → catalog, payment, gateway: *this order changed status* — **event**; catalog confirms or releases stock, payment refunds a cancelled paid order, the gateway pushes the change to browsers.

---

## 11. Scope, phasing and the course backlog

### 11.1 Delivery order — backend first, then frontend

**Phase A — Backend.** Every P0 route exists, is documented in OpenAPI, and is covered by tests.

1. Foundation: monorepo, Compose stack, gateway + one service end to end, CI.
2. catalog: menu, sizes, toppings, stock; seed menu.
3. identity: register, login, Google sign-in, sessions, roles.
4. ordering: quote, place order, stock reservation, state machine, promotions, loyalty earning.
5. payment: fake provider, then Stripe Checkout, webhooks, refunds.
6. Task 10 hardening: the three graded tests (§5 F10), the concurrency test, the idempotency test.

**Phase B — Frontend.** Generated client, then customer pages (J1 end to end), then staff board, then admin pages.

**Phase C — Handover.** `docker compose` runs web + services + infrastructure, the README, the recorded demo of J1, the Sprint Review.

Then P1, in the order the Product Owner prioritises.

### 11.2 The course's ten tasks

Every task of the brief, and where it is delivered. Each is done only when it meets the Definition of Done below.

| # | Course task | Delivered by |
| :---- | :---- | :---- |
| 1 | Project setup and structure | Phase A step 1 — monorepo with `apps/web` and `services/*`, README, Git, `.env.example` per app |
| 2 | Product list API | `GET /products` (catalog) |
| 3 | Menu page | `/` — F1 |
| 4 | Product detail and options | `/products/[id]`, `GET /products/:id` — F1 |
| 5 | Cart | F2 — React Context + browser storage, badge |
| 6 | Create-order API | `POST /orders` — validated, `PENDING`, returns the order number |
| 7 | Register / login (JWT) | F3 — bcrypt, JWT, guarded order routes |
| 8 | Cashless payment | F5 — `POST /payments`, Stripe + fake provider, `PAID` / `PAYMENT_FAILED` |
| 9 | Confirmation, history and handover | F6, `GET /orders/me`, Compose for all apps, README, demo |
| 10 | Backend business rules | F10 — state machine, idempotency, concurrent stock, promotions and loyalty, with tests |

### 11.3 Definition of Done

A backlog item is done when:

- it builds, lints, type-checks and its tests pass in CI;
- it meets its acceptance criteria in this document;
- it is committed with a Conventional Commit message and reviewed by another team member;
- every new API input is validated, and every new screen handles loading, empty and error states;
- the docs it changes — rdm-spec, api-endpoints-plan, an ADR — are updated in the same PR;
- the README says how to run it.

### 11.4 Explicitly out of scope

Delivery · table service and QR-at-table ordering · multiple stores · cash payments and a POS · native mobile apps · push notifications and email receipts · inventory of ingredients (only products are counted) · loyalty tiers, expiry and campaigns · reviews and ratings · gift cards · tipping · tax invoices · languages beyond English and Vietnamese · guest checkout (§6.8) · self-service account erasure.

---

## 12. Risks

| Risk | Impact | Mitigation |
| :---- | :---- | :---- |
| **Stripe and VND.** Stripe does not onboard Vietnamese merchants; a test-mode account from a supported country can still charge in VND, which is zero-decimal. Stripe also has a minimum charge per currency. | Live payments are not possible for a real Vietnamese shop; a tiny order could be refused. | This is a course project: **test mode only**, stated in the README. `MIN_PAYABLE_VND` keeps every charge above the minimum — verify Stripe's VND minimum when wiring payments. The fake provider keeps the demo independent of Stripe. |
| **Sign in with Apple** needs a paid Apple Developer account and a verified domain. | *Continue with Apple* may not be demonstrable. | Google is P0; Apple is P1 and ships only if the team has an account. The Firebase Auth emulator covers both in development. |
| **Microservices for a small product.** Five backend processes, a broker and a gateway are more moving parts than the features need. | Time goes into plumbing instead of features. | The course and the team want the architecture; the **product** stays minimal (§11.4). The walking skeleton proves every piece of plumbing in week one, before any feature depends on it. |
| **Distributed consistency.** Stock lives in catalog, orders in ordering, money in payment — no transaction spans them. | A lost event leaves stock reserved or an order unpaid. | Transactional outbox, idempotent consumers, a deadline on every unpaid order, an orphan sweep on reservations, and automatic refund of late payments ([ADR 0006](./decisions/0006-events-leave-through-a-transactional-outbox.md)). |
| **Webhooks in local development.** Stripe cannot reach `localhost`. | Payments never complete locally. | `stripe listen --forward-to` in the README; the fake provider for everything else. |
| **Scope creep.** | Nothing is finished. | P0 first, completely. P1 only after the J1 demo works end to end. |
