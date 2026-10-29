# BrewLite

BrewLite is a coffee-shop ordering system built as a pnpm + Turborepo monorepo: a Next.js
storefront with staff and admin consoles, a NestJS gateway, four domain services (identity,
catalog, ordering, payment), PostgreSQL, Redis, NATS JetStream and the Firebase emulators.

The customer flow is complete end to end: browse the menu, build a cart, check out, pay, then
watch the order move from `PENDING` to `PAID` → `PREPARING` → `READY` → `COMPLETED` over
Server-Sent Events. Payment uses Stripe Checkout when test keys are configured; without keys it
runs the development `fake` provider, whose card form accepts two Stripe-style test cards.

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
