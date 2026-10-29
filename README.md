# BrewLite

BrewLite is a coffee-shop ordering system built as a pnpm + Turborepo monorepo: a Next.js
storefront with staff and admin consoles, a NestJS gateway, four domain services (identity,
catalog, ordering, payment), PostgreSQL, Redis, NATS JetStream and the Firebase emulators.

The customer flow is complete end to end: browse the menu, build a cart, check out, pay, then
watch the order move from `PENDING` to `PAID` → `PREPARING` → `READY` → `COMPLETED` over
Server-Sent Events. Payment uses Stripe Checkout when test keys are configured; without keys it
runs the development `fake` provider, whose card form accepts two Stripe-style test cards.

Staff work from the same build: the board advances orders with one tap, cancels a `PAID` order
only with a reason, and refreshes itself over SSE. The stock page searches the menu, toggles
availability, sets stock counts and toppings, and reports a version conflict instead of
overwriting another device's edit. Admin pages cover users, products, categories, toppings and
promotions; product photos can be uploaded and removed there, while the other admin tables are
read-only.

## Prerequisites

- Node.js **24.14.0** (see `.nvmrc`)
- pnpm **10.34.5** (`corepack enable && corepack prepare pnpm@10.34.5 --activate`)
- Docker Desktop with Compose

## Run it locally

From the repository root:

```bash
# 1. Local environment files (never committed)
for f in services/*/.env.example; do cp "$f" "${f%.example}"; done
pnpm install
pnpm keys:dev                 # writes a local ES256 key pair into identity/gateway .env

# 2. Infrastructure: Postgres, Redis, NATS, Firebase emulators
docker compose up -d --wait

# 3. Databases, Prisma clients and the test databases
pnpm db:setup

# 4. Demo accounts (fresh databases only)
pnpm build
SEED_ACCOUNT_PASSWORD='choose-a-local-password' pnpm --filter @brewlite/identity seed:dev

# 5. All services and the web app in watch mode
pnpm dev
```

PowerShell equivalents for steps 1 and 4:

```powershell
Get-ChildItem services/*/.env.example | ForEach-Object {
  Copy-Item $_.FullName ($_.FullName -replace '\.example$', '')
}
pnpm install
pnpm keys:dev
docker compose up -d --wait
pnpm db:setup
pnpm build
$env:SEED_ACCOUNT_PASSWORD = 'choose-a-local-password'
pnpm --filter @brewlite/identity seed:dev
pnpm dev
```

Then open:

| Surface | URL |
| :---- | :---- |
| Storefront | <http://localhost:23000> |
| Swagger UI | <http://localhost:23100/docs> |
| OpenAPI JSON | <http://localhost:23100/docs-json> |
| Firebase Emulator UI | <http://localhost:29400> |

The seeded accounts are `admin@brewlite.test`, `staff@brewlite.test` and
`customer@brewlite.test`, all with the `SEED_ACCOUNT_PASSWORD` you chose. Seeding is idempotent:
it creates missing accounts only, so an existing database keeps its old password. Register a new
customer from `/register` if you do not need the seeded ones.

## Paying in the demo

`PAYMENT_PROVIDER=fake` is the default in `services/payment/.env`. The order page renders a card
form in development. Use:

| Card number | Result |
| :---- | :---- |
| `4242 4242 4242 4242` | payment succeeds |
| `4000 0000 0000 0002` | the bank declines; a new session can be opened |

Any future expiry and any 3-digit security code are accepted. The fake provider is refused when
`NODE_ENV=production`; set `PAYMENT_PROVIDER=stripe` and provide `STRIPE_SECRET_KEY` /
`STRIPE_WEBHOOK_SECRET` (payment) plus `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (web) to exercise the
real Stripe test-mode flow. Local webhooks need
`stripe listen --forward-to localhost:23100/api/webhooks/stripe`.

## Staff and admin

Log in with a seeded staff or admin account. After sign-in the app sends `STAFF` to `/staff`,
`ADMIN` to `/admin` and customers to the menu; an explicit `next` path still wins.

| Surface | URL | Notes |
| :---- | :---- | :---- |
| Staff board | <http://localhost:23000/staff> | `PAID → PREPARING → READY → COMPLETED`; cancel needs a reason |
| Stock & items | <http://localhost:23000/staff/stock> | Availability, stock counts, toppings |
| Admin | <http://localhost:23000/admin> | Users, products, categories, toppings, promotions |

Every staff action runs through a server action and the gateway; the browser never talks to a
domain service directly.

## Product images

Seed products ship without photos, so the menu shows a category illustration and says it is not
a photo of the item. Upload a real JPG, PNG or WebP (≤ 2 MB) per product at
`/admin/products`; the product page switches to the photo immediately. Removing the image brings
the illustration back.

Locally, uploads go to the Firebase Storage emulator. Next's image optimizer refuses private IPs,
so `localhost:29199` URLs are rendered unoptimized in development. A production deployment needs a
real Firebase Storage bucket and `STORAGE_PUBLIC_BASE_URL`.

Photo credits for the bundled prototype assets are listed at `/credits`.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test                 # unit and contract tests
pnpm test:integration     # needs the Compose stack and migrated test databases
pnpm --filter @brewlite/web test:e2e   # needs `pnpm dev` running
pnpm build
```

Known local pre-existing failures: parts of `packages/config` assume Linux git paths, and the
gateway `catalog-unavailable.e2e.spec.ts` fixture answers `500` instead of `503`. Everything
under `apps/web` and the payment/ordering paths used by the storefront is green.

## Before publishing

- **Payment:** set `PAYMENT_PROVIDER=stripe` in the payment service plus `STRIPE_SECRET_KEY`
  and `STRIPE_WEBHOOK_SECRET`; set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` for the web app. The
  `fake` provider refuses to boot with `NODE_ENV=production`. Point the Stripe webhook at
  `https://<host>/api/webhooks/stripe`.
- **Storage:** point the catalog at a real Firebase project (`FIREBASE_PROJECT_ID`,
  `FIREBASE_STORAGE_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS`) and set
  `STORAGE_PUBLIC_BASE_URL` to the bucket's public URL. Remove the emulator host.
- **Data:** run `pnpm db:deploy` against the production databases, then seed only the reference
  menu (`db:setup` is for local/test). Create real staff and admin accounts with the identity
  seed or the admin API; demo passwords must not ship.
- **Runtime:** set `NODE_ENV=production`, serve the web app over HTTPS (cookies become `Secure`),
  and give every service its own secrets. `.env` files are git-ignored.
- **Smoke test:** sign in as customer, staff and admin; place one paid order; advance it on the
  staff board; upload one product photo and confirm it renders on the product page.

## Repository map

```text
apps/web/            Next.js storefront, staff console and admin console
services/gateway/    public HTTP API (the only service the web app calls)
services/identity/   accounts, passwords, Firebase exchange, sessions, roles
services/catalog/    menu, sizes, toppings, images and stock
services/ordering/   quotes, orders, state machine, promotions, loyalty
services/payment/    payment sessions, Stripe webhooks, refunds
packages/            contracts, nest-common, generated API client, shared config
docs/                product, architecture, data, API and decision records
```

Start with [`docs/README.md`](docs/README.md) for the document map; decisions live in
[`docs/decisions/`](docs/decisions/).
