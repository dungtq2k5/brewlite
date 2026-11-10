# 0033 — Browsers reach the web app only through Caddy, which sets the client address

**Status:** Accepted · **Date:** 2026-10-20 · **Supersedes:** — · **Superseded by:** —

## Context

The gateway rate-limits guests by IP address (api-endpoints-plan §0.8) and trusts exactly one hop: the web server, which forwards the address it saw the browser connect from in `X-Forwarded-For` (ADR 0014, api-endpoints-plan §0.1). That only works if the web server knows the real address.

Next.js 16 does not tell it. Checked against `next dev` and `next start`: Next sets `x-forwarded-for` from the socket **only when the request has none**, and passes a browser's own header through untouched — so `X-Forwarded-For: 1.2.3.4` from any browser reaches the app as `1.2.3.4`. `NextRequest.ip` is gone, and neither `proxy.ts` nor a Server Component can read the socket. Whatever the web server forwards, a browser could choose it, and with it its own rate-limit bucket.

The options:

- **Forward nothing** — every guest shares the web server's single bucket, 120 requests a minute for the whole shop.
- **A wrapper server around Next** that overwrites the header from the socket — about fifteen lines, but it starts Next through internal modules and replaces the generated standalone `server.js`; Next does not support a custom server with standalone output, so every upgrade could break the one piece of code that guards the limits.
- **A reverse proxy in front** — the standard production arrangement; one more container.

Separately, the installable PWA (ADR 0032) needs HTTPS anywhere but `localhost`, so a demo on a real phone needs a TLS endpoint in front of the web app regardless.

## Decision

- **Caddy is the only way into the web app.** In the Compose `apps` profile a `caddy` container publishes `127.0.0.1:23000` and reverse-proxies to `web:23000`; the `web` container publishes **no** host port.
- Caddy **ignores an `X-Forwarded-For` from an untrusted client and sets the socket address itself** (its default; no `trusted_proxies` configured). The web server therefore sees one trustworthy value, and forwards it — the rightmost entry — to the gateway.
- The Caddyfile (`infra/docker/caddy/Caddyfile`) passes streams through unbuffered (`flush_interval -1`), so the order-status streams (ADR 0022) arrive as they are written.
- **Serving a real phone over HTTPS** is one site address in the same file — Caddy obtains the certificate.
- **Local development** (`next dev` on the host) runs without Caddy: on `localhost` a browser sends no `X-Forwarded-For`, so Next fills in the true socket address.

## Consequences

- The client address is correct with no application code: no custom server, no reliance on Next's internals, and Next upgrades cannot break it.
- A PWA demo on a phone gets HTTPS from the same container.
- **Cost:** one more container and one more hop in the `apps` profile and in CI's end-to-end job.
- **Cost:** the web container must never be published directly — a direct port would bypass Caddy and reopen the spoof. Compose is where that is enforced; a deployment must keep the same shape.
- **Cost:** in local development the address is trustworthy only because nobody spoofs their own `localhost`; the guarantee is the `apps` profile's, and any deployment's.

## See also

- [0014](./0014-the-web-server-is-the-gateways-only-client.md) — the web server is the gateway's only client and the hop it trusts.
- [0022](./0022-order-updates-reach-browsers-as-server-sent-events.md) — the streams Caddy must not buffer.
- [0032](./0032-the-web-app-is-an-installable-pwa-whose-service-worker-caches-no-data.md) — why HTTPS matters for a demo on a phone.
