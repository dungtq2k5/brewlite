# 0016 — Three fixed roles map to a compile-time permission catalogue

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

One web app serves customers, staff and admins. Access must be checked on every route, and the check should say *what* is being done, not *who* may do it — so that giving staff one more ability is one edit, not a hunt through guards.

The reference project stored roles and their permissions in the database with an admin role editor. For one coffee shop with three kinds of people, a role editor is a feature nobody uses and a surface for mistakes.

## Decision

- Exactly three roles: **`CUSTOMER`**, **`STAFF`**, **`ADMIN`** — one per account, a `role` column on `users`, defaulting to `CUSTOMER`. An admin changes it; nobody else.
- The **permission catalogue** and the **`ROLE_PERMISSIONS`** map are constants in `packages/contracts`. `ADMIN` holds every permission; `STAFF` holds the counter's; `CUSTOMER` holds none (their routes need only a signed-in account and ownership).
- **Routes declare a permission**, never a role: `@RequirePermission('order.status.update')`. The gateway resolves the token's `role` to permissions through the map.
- **Ownership is checked in the service**, in the query (`WHERE id = $1 AND user_id = $2`); another customer's order is `404`, never `403`.
- The last `ADMIN` cannot be demoted or locked.

## Consequences

- The permission list and the role grants are reviewed in code, with the route that uses them.
- The web app uses the same map to hide what a role cannot do (UX only; the gateway enforces).
- **Cost:** a new role, or moving one permission between roles, is a code change and a deploy.
- **Cost:** a role change takes effect when the user's access token expires (≤ 15 min); their sessions are revoked so the next refresh forces a sign-in with the new role.
- Rejected: dynamic roles in the database — flexibility a single shop does not need.

## See also

- [0013](./0013-identity-issues-brewlite-tokens-and-firebase-only-proves-sign-ins.md) — the `role` claim in the access token.
- [0001](./0001-one-store-with-pickup-at-the-counter.md) — one store is why three roles suffice.
