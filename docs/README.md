# Documentation Map

Start here. Every document has exactly one job; this page says which.

Two things are always true of this folder. **Each document answers one question** — if you cannot say which, it should not be a document. And **`decisions/` owns every "why"**: the other documents describe what is true and cite an ADR instead of re-arguing it, because a rationale copied into two places diverges in one of them.

---

## Core — read before your first commit

| Document | Authoritative for |
| :---- | :---- |
| [product-overview.md](./product-overview.md) | **What we are building.** Vision, actors, pages, glossary, features (P0/P1/P2), business rules (pricing, stock, the order state machine, promotions, loyalty, idempotency, guests, deletion and locking), journeys, constants, the course's ten tasks and the Definition of Done |
| [architecture-and-tech-stack.md](./architecture-and-tech-stack.md) | **What to know before writing code.** Technology and versions, repository layout, ports, services, data, the web app, identity, Stripe, testing, CI, environment variables |
| [rdm-spec.md](./rdm-spec.md) | **Every table, column, constraint and index**, per service database, with the rule behind each column. Tables carry stable identifiers (`I-1`, `C-2`, `O-1`, `P-1`) cited from code |
| [api-endpoints-plan.md](./api-endpoints-plan.md) | **Every endpoint, auth rule, error code, server-sent event, JetStream subject, internal RPC and permission** |
| [development-conventions.md](./development-conventions.md) | **How to write the code.** Rules and examples only — reasoning lives in `decisions/` |
| [decisions/](./decisions/) | **Why.** One decision per file, append-only |

**Reading order for a new developer:** product-overview → architecture-and-tech-stack → development-conventions §1–2 → the rdm-spec and api-endpoints-plan sections for the service you are about to touch.

**When two documents disagree:** rdm-spec wins on data shape, api-endpoints-plan on the wire contract, development-conventions on how code is written, product-overview on product behaviour, and an ADR on why. Fix the other one in the same PR.

---

## `decisions/` — why, permanently

**Append-only.** An accepted decision is never edited; changing it means a new ADR that decides the new thing, with `Supersedes` / `Superseded by` filled in on both. Numbers never move, which is what makes them safe to cite from code. The only other edit allowed is a lint fix to a table delimiter row or a code-fence language. `packages/config/guards/adr-structure.spec.ts` checks every ADR's first three lines, its sections, the `Supersedes` / `Superseded by` pair, and that it has a row below.

Each title is an **assertion**, not a topic, so this index reads as the rules the codebase runs under. Every ADR states its **cost**. Start from [TEMPLATE.md](./decisions/TEMPLATE.md).

### Product and money

| ADR | Decides |
| :---- | :---- |
| [0001](./decisions/0001-one-store-with-pickup-at-the-counter.md) | BrewLite serves one store, with pickup at the counter only |
| [0002](./decisions/0002-every-amount-is-an-integer-number-of-dong.md) | Every amount is an integer number of Vietnamese đồng |
| [0029](./decisions/0029-guests-browse-and-build-a-cart-and-sign-in-only-to-order.md) | Guests browse and build a cart; signing in is required only to order |

### Repository and build

| ADR | Decides |
| :---- | :---- |
| [0003](./decisions/0003-one-pnpm-turborepo-monorepo-with-a-fixed-layout.md) | The repository is one pnpm + Turborepo monorepo with a fixed layout |
| [0012](./decisions/0012-swc-compiles-everything-and-nest-packages-are-commonjs.md) | SWC compiles every package; Nest services and shared packages are CommonJS |
| [0027](./decisions/0027-host-ports-sit-in-the-2xxxx-range.md) | Local host ports sit in the 2xxxx range |

### Services and communication

| ADR | Decides |
| :---- | :---- |
| [0004](./decisions/0004-the-backend-is-a-gateway-plus-four-domain-services.md) | The backend is a NestJS gateway plus four domain services |
| [0005](./decisions/0005-grpc-for-synchronous-calls-and-jetstream-for-events.md) | gRPC carries synchronous calls; NATS JetStream carries every event |
| [0006](./decisions/0006-events-leave-through-a-transactional-outbox.md) | Events leave a service through a transactional outbox, and consumers are idempotent by construction |
| [0011](./decisions/0011-zod-is-the-only-schema-language-and-orval-generates-the-client.md) | zod is the only schema language, and the web client is generated from it by Orval |
| [0022](./decisions/0022-order-updates-reach-browsers-as-server-sent-events.md) | Order updates reach browsers as Server-Sent Events fed from NATS |
| [0023](./decisions/0023-redis-holds-only-reconstructible-state.md) | Redis holds only reconstructible state: rate limits, cache and job queues |

### Data

| ADR | Decides |
| :---- | :---- |
| [0007](./decisions/0007-one-postgres-server-with-a-database-per-service.md) | One Postgres server holds one database per service, and nothing crosses between them |
| [0008](./decisions/0008-services-query-prisma-7-directly.md) | Services query Prisma 7 directly; there is no repository layer |
| [0009](./decisions/0009-every-identifier-is-a-uuidv7.md) | Every identifier is a UUIDv7; the order number people read is a separate sequence |
| [0010](./decisions/0010-enumerated-columns-are-strings-not-prisma-enums.md) | Enumerated columns are strings, never Prisma enums |
| [0025](./decisions/0025-product-images-live-in-firebase-storage.md) | Product images live in Firebase Storage and are uploaded through catalog |
| [0030](./decisions/0030-rows-others-cite-are-soft-deleted-and-accounts-are-locked-or-deactivated.md) | Rows others cite are soft-deleted, and accounts are locked or deactivated, never removed |

### Ordering and payments — the course's Task 10

| ADR | Decides |
| :---- | :---- |
| [0017](./decisions/0017-stripe-checkout-is-the-payment-surface.md) | Stripe Checkout is the payment surface, fulfilled only from webhooks |
| [0018](./decisions/0018-stock-is-reserved-at-order-creation-under-optimistic-locking.md) | Stock is reserved at order creation under optimistic locking |
| [0019](./decisions/0019-order-status-changes-only-through-the-state-machine.md) | Order status changes only through the state machine, as conditional updates |
| [0020](./decisions/0020-idempotency-keys-are-enforced-by-a-unique-constraint.md) | Idempotency keys are enforced by a unique constraint, not a cache |
| [0021](./decisions/0021-promotions-and-loyalty-live-in-the-ordering-service.md) | Promotions and loyalty points live in the ordering service |

### Identity and access

| ADR | Decides |
| :---- | :---- |
| [0013](./decisions/0013-identity-issues-brewlite-tokens-and-firebase-only-proves-sign-ins.md) | Identity issues BrewLite's tokens; Firebase Auth only proves Google and Apple sign-ins |
| [0014](./decisions/0014-the-web-server-is-the-gateways-only-client.md) | The web server is the gateway's only client, and tokens live in its httpOnly cookies |
| [0016](./decisions/0016-three-fixed-roles-and-a-compile-time-permission-catalogue.md) | Three fixed roles map to a compile-time permission catalogue |

### Web app and testing

| ADR | Decides |
| :---- | :---- |
| [0015](./decisions/0015-nextjs-server-features-replace-client-data-libraries.md) | Next.js server features replace TanStack Query and Zustand; the cart is client state |
| [0026](./decisions/0026-the-ui-is-tailwind-with-daisyui.md) | The UI is Tailwind CSS 4 with DaisyUI |
| [0028](./decisions/0028-the-ui-speaks-english-and-vietnamese-through-i18next.md) | The UI speaks English and Vietnamese through i18next; English is the default |
| [0031](./decisions/0031-menu-content-is-written-in-english-and-vietnamese.md) | Menu content is written in English and in Vietnamese, as column pairs |
| [0024](./decisions/0024-vitest-is-the-only-test-runner.md) | Vitest runs every non-browser test; integration tests use paired test databases |

---

## Working documents and the archive

`docs/archive/` is **git-ignored scratch**: the course brief (`brewlite-requirements.pdf`), reference material from another project (`ref/`), and the numbered implementation docs (`impls/NN-*.md`) with their review notes (`temp/`).

An implementation doc exists to carry one slice of work from prose into code, following the loop: *doc written → reviewed → revised → implemented → implementation summary noted → next doc*. It is disposable once its slice is merged. **Nothing durable may link into the archive** — not this folder, not an ADR, not a docblock. Anything in an implementation doc that outlives it moves into an ADR (why) or one of the core documents (what is true now) in the same PR that implements it. `packages/config/guards/archive-references.spec.ts` enforces this.

---

## Diagrams

Diagrams live **inside** the document they illustrate — a state machine in product-overview, a flow in api-endpoints-plan, a decision's picture in its ADR — never in a folder of their own. Use `text` code fences (or mermaid where GitHub rendering matters); never an exported image or a `.drawio` file, whose diffs cannot be reviewed. There is no unified ERD: the four databases share no foreign key, and a merged diagram would draw relations that do not exist.

---

## Writing docs

- **`pnpm lint:md` must pass.** Rules live in `.markdownlint-cli2.jsonc`: lines are not wrapped by hand, tables are compact (one space of padding, never aligned), `<br>` is the only HTML allowed.
- **Every table delimiter cell is `:----`**; the custom rule `brewlite-table-delimiter` (`packages/config/markdownlint/`) enforces it, and `pnpm lint:md --fix` rewrites a wrong row.
- **Every code fence names a language** — `text` for diagrams, trees and state machines.
- **Every doc opens with a `#` heading.**
- **Nothing tracked cites the archive** — by path, by link, or as "doc NN".
- The product is **BrewLite**; the UI speaks English (default) and Vietnamese; the docs and the code speak English.

---

When a rule in `development-conventions.md` conflicts with the code, one of them is wrong — say which in the pull request rather than silently following the other. When the code conflicts with an ADR, the ADR is not automatically wrong either: it may record a decision someone drifted away from without deciding to.
