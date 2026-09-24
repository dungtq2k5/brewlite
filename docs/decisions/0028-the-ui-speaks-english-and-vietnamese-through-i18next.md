# 0028 — The UI speaks English and Vietnamese through i18next; English is the default

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

BrewLite is sold in Vietnam and charges in đồng, but the team wants English as the default UI language, with Vietnamese one tap away. The first draft of the docs made the UI Vietnamese-only with a hand-written error dictionary, which only works while there is exactly one language.

Two languages means plurals, interpolation with different word orders, per-request language on the server (Server Components render per visitor), and a way to keep both languages complete. Next.js has no built-in translation layer for the App Router. Locale-prefixed URLs (`/vi/menu`) help search engines, which a single shop's ordering app does not need, and they would restructure every route.

## Decision

- **i18next** + **react-i18next**, resources loaded per namespace with `i18next-resources-to-backend`.
- Locales `en` (**default**) and `vi`. English is the source language; Vietnamese must have every key (a guard test).
- **The locale is a cookie, not a URL segment:** `bl_locale`, resolved on every request, `en` when absent. `Accept-Language` is ignored — the default is a decision, not a guess. A signed-in user's choice is saved as `users.preferred_locale` and restored at sign-in.
- Server Components translate through a **per-request** instance (`getT`); Client Components through `useTranslation` under a provider seeded by the server.
- Resources live in `apps/web/src/i18n/locales/<locale>/<namespace>.json` — the web app is their only consumer.
- **Servers still send codes, never sentences**; error codes are keys in the `errors` namespace.
- **Money is always VND**, formatted per locale (`₫123,000` / `123.000 ₫`); times always in `Asia/Ho_Chi_Minh`.
- Menu content (what the admin types) is data, not a translation key; whether it becomes bilingual is a separate schema decision (rdm-spec OD-1).

## Consequences

- Every label, message and error exists in both languages, and a third language is a folder of JSON plus one value in `SUPPORTED_LOCALES`.
- **Cost:** every UI string is a key in two files, for every feature — roughly doubling the copy work, and a lint rule plus a key-parity test to keep it honest.
- **Cost:** i18next in the App Router needs care — a module-level instance on the server would leak one visitor's language into another's render. The per-request `getT` pattern must be verified on the pinned Next.js version.
- **Cost:** no locale in the URL means a shared link opens in the recipient's own language, and search engines index English only. Acceptable for an ordering app.
- Until OD-1 is decided, an English UI can show Vietnamese product names.

## See also

- [0015](./0015-nextjs-server-features-replace-client-data-libraries.md) — the Server Component / Client Component split the translation pattern follows.
- [0002](./0002-every-amount-is-an-integer-number-of-dong.md) — the currency that does not change with the locale.
- [0029](./0029-guests-browse-and-build-a-cart-and-sign-in-only-to-order.md) — a guest's locale lives in the browser, an account's on the user.
