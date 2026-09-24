# 0014 — The web server is the gateway's only client, and tokens live in its httpOnly cookies

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

Next.js renders on the server. If the browser also called the gateway directly, the gateway would need CORS, cookies or browser-readable tokens, CSRF defences, and two call paths — one from Server Components, one from client code. A token readable by JavaScript is stolen by any XSS.

Refresh tokens are commonly **rotated** with reuse detection: each refresh issues a new token, and presenting a spent one revokes the whole session. With a server-rendered app, several requests (a navigation plus prefetches) can hit an expired access token at the same moment and all try to refresh with the same cookie; the losers present a spent token and sign the user out.

## Decision

- **The browser talks only to the Next.js server.** The Next.js server is the only client of the gateway, besides Stripe's webhook. It calls the gateway with `Authorization: Bearer <access token>`. The generated API client is server-only.
- Tokens live in **`httpOnly`, `SameSite=Lax`** cookies on the web origin: **`bl_at`** (access, 15 min) and **`bl_rt`** (refresh, 30 days), `Secure` outside development. Browser JavaScript never sees a token.
- **The gateway speaks bearer tokens only** — no cookies, no CORS configuration.
- **`proxy.ts`** refreshes: when `bl_at` is missing or expired and `bl_rt` exists, it calls `POST /auth/refresh` and sets fresh cookies. Sign-in and sign-out are Server Actions. A Server Component cannot set cookies and never tries.
- Mutations are **Server Actions** (Next checks their origin); SSE streams are proxied by Route Handlers.
- **The refresh token is not rotated.** It is an opaque, hashed, revocable session token: sign-out deletes the session; a role change or a lock deletes all the user's sessions.

## Consequences

- One call path, no CORS, no CSRF tokens, no token in browser storage.
- **Cost:** every API call pays an extra hop through the Next.js server, and SSE connections are held open by it.
- **Cost:** without rotation, a stolen refresh cookie works until its 30 days end or the user signs out. Mitigated by `httpOnly` (no script can read it), `SameSite=Lax`, and server-side revocation; accepted because rotation's theft detection would, in this architecture, mostly sign out honest users racing themselves.
- **Cost:** an access token stays valid up to 15 minutes after a role change or lock.
- A native mobile client later would need its own transport (bearer tokens in secure storage) — the gateway already supports bearer tokens, so that is additive.

## See also

- [0013](./0013-identity-issues-brewlite-tokens-and-firebase-only-proves-sign-ins.md) — how the tokens are issued.
- [0015](./0015-nextjs-server-features-replace-client-data-libraries.md) — how the web server fetches and mutates.
- [0022](./0022-order-updates-reach-browsers-as-server-sent-events.md) — the streams the Route Handlers proxy.
