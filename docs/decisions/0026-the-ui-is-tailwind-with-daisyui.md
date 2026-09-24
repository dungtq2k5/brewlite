# 0026 — The UI is Tailwind CSS 4 with DaisyUI

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

The course brief suggests TailwindCSS. The web app has about twenty screens — menu cards, a product detail with option pickers, a cart, a checkout, a tracking stepper, a kanban-style board, admin tables and forms. Building every component from utility classes is slow; a component library such as shadcn/ui copies React components into the repo, which then must be maintained.

## Decision

- **Tailwind CSS 4** with **DaisyUI 5** as a Tailwind plugin. DaisyUI's semantic classes (`btn`, `card`, `badge`, `modal`, `drawer`, `steps`, `table`, `join`) build the screens; Tailwind utilities adjust layout and spacing.
- **One BrewLite theme** defined with DaisyUI's theme variables — colours, radius, fonts — mobile-first.
- No React component library.

## Consequences

- Components are CSS classes, not JavaScript: nothing to hydrate, works in Server Components.
- **Cost:** DaisyUI's defaults look generic; the theme has to be designed, not left at defaults.
- **Cost:** DaisyUI provides no behaviour — focus traps, keyboard handling and ARIA wiring for interactive components (modals, drawers) are ours, or come from native elements (`<dialog>`, `<details>`).
- **Cost:** DaisyUI 5 targets Tailwind 4; upgrading either is a coordinated change.

## See also

- [0015](./0015-nextjs-server-features-replace-client-data-libraries.md) — the rendering model this styling serves.
