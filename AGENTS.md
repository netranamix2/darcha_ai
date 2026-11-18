# Darcha — project rules

Darcha is an AI platform that answers citizens' appeals to Uzbekistan's Ministry of Education and Science based on official regulations. Every AI answer cites a document; if unsure, the appeal goes to a human. This repo is a monorepo: `frontend/` (React web app) and later `backend/` (FastAPI, built by a teammate).

## Frontend stack
- React 18 + Vite + TypeScript (strict, no `any`).
- Tailwind CSS v4 for styling, shadcn/ui primitives (restyled to our design system), lucide-react icons.
- Motion (framer-motion / `motion/react`) for animation. Recharts for charts.
- React Router. TanStack Query for data fetching.
- No other UI kits.

## Data layer
- All API calls go ONLY through `frontend/src/api/client.ts`. Types live in `frontend/src/api/types.ts`.
- If `VITE_API_URL` is empty, the client returns mock data from `frontend/src/api/mocks/` with a realistic delay (400–1200 ms). Components must never know whether data is mock or real.
- The API contract is fixed (see types.ts). Never invent new endpoints without a comment `// TODO(backend): ...`.

## Design system — "Darcha: the window"
- Draw on Uzbek carved window lattices (panjara and girih geometry) and Samarkand turquoise tilework. Keep the product editorial, restrained, and suitable for government use.
- Use space, alignment, typography, and 1px hairlines to organize content. Keep at most one level of containers. Use rows for lists. Icons are sparse, inline, and typically 16px with a 1.5px stroke.
- Keep colors in one theme file. Use flat ink #0D1219, raised #131A24, hairline #222C3A, and row hover #17202C. Use ivory #EDE7DC, secondary #A3A9B4, and muted #6B7380 for text.
- Use Samarkand turquoise #1FB5A8 (hover #2BCFC0) for primary actions, focus, active navigation, links, and the lit logo pane. Saffron #D9A441 can highlight one or two items per screen. Statuses use a small dot or rule with text in green #3FB27F, amber #D9A441, or red #E05D5D.
- Glass is reserved for sticky headers, the chat composer, drawers, modals, and popovers. Use 14px backdrop blur, rgba(19, 26, 36, 0.72) fill, and a hairline border. Use solid surfaces elsewhere.
- Use Source Serif 4 at 500–600 with optical sizing for one main heading per page. Use IBM Plex Sans at 15px / 1.55 for the UI, 13px secondary for section labels, and IBM Plex Mono with tabular figures for data, IDs, dates, and timers. Verify Uzbek Latin including U+02BB and Cyrillic coverage.
- Use a thin SVG eight-point star and octagon lattice at 4–6% opacity with a radial fade on the public hero, empty states, and the login side. Keep dense data clear of the pattern. Use the square window mark with four panes, a fine star, and one turquoise pane as the brand and assistant avatar.
- Remove glowing orbs, gradient headlines, trust pills, connected steppers, feature-card grids, decorative arrows, fake stats, drifting blobs, cursor spotlights, floating card shells, magnetic buttons, and icons in rounded-square tiles.

## Motion rules — purposeful and quiet
- Animate only `transform` and `opacity`. Use a 200ms route fade, 30ms row stagger on first load, spring drawer and modal slides, and message entrance with a 6px translation. Roll up KPI numerals on first view.
- The thinking indicator lights the window panes in sequence using opacity, alongside the localized analysis, document search, and verification steps.
- Keep at most one decorative animation per screen. Remove spotlight, magnetic, glow-pulse, and floating-blob effects.
- Respect `prefers-reduced-motion` by disabling nonessential animation. Lazy-load route pages and target 60 fps on a mid-range laptop.

## i18n
- UI languages: Uzbek Latin (default), Uzbek Cyrillic, Russian. All UI strings in `frontend/src/i18n/` dictionaries, never hardcoded in components.

## Code quality
- Small, reusable components in `frontend/src/components/`. Pages in `frontend/src/pages/`.
- Accessible: keyboard focus states, aria labels on icon buttons, sufficient contrast on glass.
- After each task: run `npm run build` and `npm run lint`, fix all errors before finishing.
