# 0031 — Menu content is written in English and in Vietnamese, as column pairs

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

[ADR 0028](./0028-the-ui-speaks-english-and-vietnamese-through-i18next.md) made the interface bilingual but left the menu itself — what the admin types — as data in a single language, recorded as open decision OD-1. An English UI showing *Cà phê sữa đá* with a Vietnamese description is half-translated exactly where the customer is choosing what to buy.

The options were: one field and let the admin type both (*Cà phê sữa đá (Iced milk coffee)*), a column pair per text, or a generic translations table keyed by entity, field and locale. Adding languages later means filling in every existing row, so the choice had to be made before the catalog schema exists.

## Decision

- Category, product and topping **names** and product **descriptions** are stored as column pairs: `name_en` / `name_vi`, `description_en` / `description_vi`.
- **Both languages are required** on every write; descriptions are both present or both absent (`CHECK`). A name is unique among live rows **per language**.
- The API carries each pair as **`LocalizedText = { en, vi }`**, in every response, with no locale parameter. The web app renders it with `localized(text, locale)`.
- Order lines **snapshot both** product-name languages and both topping-name languages, so an old order reads correctly in either language.
- Admin-only text (promotion descriptions) and customer-typed text (order notes) stay single-language.

## Consequences

- The English UI is English end to end, the Vietnamese UI Vietnamese end to end, and neither ever falls back to the other.
- One menu response and one cache entry serve every reader; switching language needs no refetch.
- **Cost:** every admin form has two fields per text, and the admin must write both — a product cannot be published half-translated.
- **Cost:** menu payloads carry both languages, roughly doubling the text bytes. At a few dozen products that is a few kilobytes.
- **Cost:** a third language is a new column per pair and a migration, not a row. A translations table would have made that cheap, at the price of a join on every menu read and a schema nobody can read at a glance; two fixed languages do not justify it.
- Development seeds must be bilingual.

## See also

- [0028](./0028-the-ui-speaks-english-and-vietnamese-through-i18next.md) — the UI half of bilingualism; this resolves its open question.
- [0030](./0030-rows-others-cite-are-soft-deleted-and-accounts-are-locked-or-deactivated.md) — the live-row uniqueness each name pair follows.
