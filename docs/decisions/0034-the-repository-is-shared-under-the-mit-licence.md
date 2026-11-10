# 0034 — The repository is shared under the MIT licence

**Status:** Accepted · **Date:** 2026-11-10 · **Supersedes:** — · **Superseded by:** —

## Context

The repository had no licence. Without one, nobody else may reuse any of it — not a classmate, not a later team, not the lecturer showing it as an example — and every `package.json` said nothing either.

The real choice was between a permissive licence and a copyleft one:

- **AGPL-3.0** would oblige anyone who runs a modified BrewLite as a service to publish their changes, and the web app would have to offer its own source to every user over the network. That protects a product someone operates; BrewLite is a course project, not a hosted service, and nobody operates it for customers.
- **MIT** lets anyone reuse the code for anything, keeping only the copyright notice. It sits beside the MIT, ISC, BSD and Apache-2.0 packages the repository depends on, and the OFL fonts, with nothing to reconcile.

## Decision

- The repository is licensed **MIT**: a root `LICENSE` with the standard text and `Copyright (c) 2026 BrewLite contributors`.
- **Every `package.json`** — the root and each workspace package — says `"license": "MIT"`. The packages stay `private`; nothing is published.
- No per-file headers and no in-app source link: the root `LICENSE` covers the repository.

## Consequences

- Anyone may copy, change and ship BrewLite or any part of it, including in closed products, as long as the notice travels with it.
- **Cost:** nothing stops a reuser from keeping their improvements to themselves. Choosing copyleft later means a new ADR and agreement from every contributor whose code would be relicensed.
- **Cost:** a new dependency under a copyleft licence would now need a deliberate look before it ships — `pnpm licenses list --prod` is the check (at this decision: none GPL or AGPL; one LGPL native library, `sharp`'s libvips, used unmodified).

## See also

- [0003](./0003-one-pnpm-turborepo-monorepo-with-a-fixed-layout.md) — the one repository this licence covers, package by package.
