# 0030 — Rows others cite are soft-deleted, and accounts are locked or deactivated, never removed

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

Orders, reservations, payments and loyalty rows point at users, products, categories, toppings and promotions — often across services, where no foreign key can stop a hard delete from leaving a dangling id. An admin who deletes a product by mistake, or a barista account deactivated when they leave and hired back next season, should be one click from restored. And "who removed this, and when" is the first question when the menu looks wrong.

The first draft used a different mechanism per table: `locked_at` on users, `archived_at` on products and toppings, a hard delete on categories. Three shapes for one idea invite a fourth.

Accounts also need two different stops. A temporary or investigative block — "suspicious orders, lock until Friday" — is not the same act as retiring an account, and a single `locked_at` could not say *why* or *until when*.

## Decision

- **One soft-delete shape** on every table another row cites or an admin may restore — `users`, `categories`, `products`, `toppings`, `promotions`: `deleted_at` + `deleted_by_id`, written together, cleared together on restore. These tables never take a `DELETE`. Orders, payments, refunds and loyalty rows are never deleted at all.
- Every read filters `deleted_at IS NULL` unless it is an admin read that says so in its name.
- Unique values follow *does the row come back?*: menu names are unique among live rows (partial index), emails and promo codes stay reserved (full index).
- **Accounts have two independent stops:**
  - **Lock** — `is_locked`, `locked_until`, `lock_reason`: investigative or temporary, with a mandatory reason (admin-only, never shown to the user) and an optional end, after which it lifts itself lazily at the next sign-in or refresh.
  - **Deactivate** — the account's soft delete: for good, but restorable; the email stays reserved.
- Both delete every session; neither can target yourself or the last active admin.

## Consequences

- Nothing a financial record or reservation points at can vanish; every removal says who and when; every removal is reversible.
- One shape, one helper (`live()`), one review question for every soft-deletable table.
- **Cost:** every query on those tables must remember the filter — Prisma has no global filter. A forgotten `deletedAt: null` quietly returns deleted rows; the checklist and code review are the guard.
- **Cost:** deleted rows accumulate forever. At one shop's volume that is nothing; a purge would need its own decision.
- **Cost:** restores can collide with live unique values and must be refused with a clear code.
- **Cost:** there is still no audit log; `deleted_by_id` records only the latest deletion, not a history of deletes and restores.
- Self-service erasure of a customer's personal data is a different operation and out of scope.

## See also

- [0007](./0007-one-postgres-server-with-a-database-per-service.md) — no cross-service foreign keys, which is why the referenced side must never disappear.
- [0016](./0016-three-fixed-roles-and-a-compile-time-permission-catalogue.md) — the admin role that locks, deactivates and restores.
- [0014](./0014-the-web-server-is-the-gateways-only-client.md) — deleting sessions, and the 15-minute access-token window that remains.
