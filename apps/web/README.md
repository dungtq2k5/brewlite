# BrewLite Web

The Next.js app runs on port `23000` and is part of the root pnpm workspace.

## Run only the frontend

From the repository root:

```powershell
pnpm --filter @brewlite/web dev
```

This starts Next.js only. The root `pnpm dev` command also starts the Docker backend stack.

The STAFF routes are a static UI scaffold with sample data, so they render without the gateway:

- `/staff` — order board
- `/staff/products` — product availability and stock

Customer pages may show empty data or a connection message when the gateway is offline because
those routes read live API data. The STAFF scaffold does not call the gateway, Firebase, or the
generated API client.

## Checks

```powershell
pnpm --filter @brewlite/web typecheck
pnpm --filter @brewlite/web lint
pnpm --filter @brewlite/web format:check
pnpm --filter @brewlite/web build
```

The Node and pnpm versions follow the repository's `.nvmrc` and root `package.json`.
