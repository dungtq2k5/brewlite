# 0032 — The web app is an installable PWA whose service worker caches no data

**Status:** Accepted · **Date:** 2026-10-02 · **Supersedes:** — · **Superseded by:** —

## Context

Most customers order on a phone, and a regular orders from the same café again and again. Until now the product was "a website, not an installed app" (product-overview §3). The team wants the app on the home screen: one tap from the icon, full screen, the cart still there.

A Progressive Web App gives that without an app store: a web app manifest makes the site installable, and a service worker can serve a page when the network is gone. But a service worker is a cache in front of every request, and almost nothing BrewLite serves may be cached:

- Pages are rendered per request with the visitor's session, locale and live prices; the web app deliberately caches no API data (architecture §2.6, ADR 0015).
- Orders cannot be placed offline — the server prices them, reserves stock and takes payment through Stripe.
- Server Actions, the order-status streams (ADR 0022) and Stripe's embedded Checkout must reach the network untouched.

The usual payoff of a PWA, push notifications ("your order is ready"), is out of scope (product-overview §11.4). Libraries exist (`next-pwa`, unmaintained; Serwist, with Turbopack friction), but what is needed here is small.

## Decision

- **The web app is installable:** `app/manifest.ts` (Next.js's built-in manifest route) with the name, icons, `display: standalone`, `start_url: /` and the theme colours.
- **One hand-written service worker** (`public/sw.js`, registered from the root layout in production builds):
  - **caches only immutable assets** — the content-hashed `/_next/static/*`, the icons and the fonts — cache-first;
  - **caches no page and no API response**: documents, Server Actions, Route Handlers (the event streams included) and every cross-origin request (Stripe, Firebase) go straight to the network;
  - serves **one offline page** when a navigation fails — "You're offline — your cart is saved on this device".
- **Updates are safe by construction:** pages are never cached, so every page load fetches HTML that names the current build's assets; a new worker takes over on the next navigation (`skipWaiting`, `clients.claim`), and old asset caches are deleted on activation.
- **No offline ordering, no background sync, no push.** Each would be its own decision.
- The PWA works on `localhost` (a secure context) and needs **HTTPS** anywhere else.

## Consequences

- One tap from the home screen, full screen, the cart in `localStorage` surviving as before; static assets load from the device after the first visit.
- Nothing the service worker serves can be stale in a way that matters: no prices, no orders, no session, no language.
- **Cost:** standalone mode has no browser back button or address bar — every screen needs its own way back, and layouts respect the safe-area insets (the notch).
- **Cost:** Google and Apple sign-in through Firebase's popup is unreliable in an installed iOS app; the web foundation must verify it there and fall back to redirect sign-in if needed.
- **Cost:** Apple Pay inside Stripe's embedded Checkout may not be offered in an installed iOS app; card payment still works.
- **Cost:** a service worker is a second place a request can go wrong — it must be tested to pass Server Actions and the event streams straight through.

## See also

- [0014](./0014-the-web-server-is-the-gateways-only-client.md) — why no API response reaches the browser to be cached.
- [0015](./0015-nextjs-server-features-replace-client-data-libraries.md) — the web app caches no API data.
- [0022](./0022-order-updates-reach-browsers-as-server-sent-events.md) — the streams the worker must not touch.
