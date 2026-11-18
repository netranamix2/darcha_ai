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

## Design system — "Liquid glass", dark, premium
- Dark background with slow, soft aurora gradient blobs; frosted glass surfaces on top.
- Glass surface: semi-transparent white fill (4–8%), backdrop blur 16–24px, 1px border white 10–14%, subtle inner top highlight, large soft shadow. Radius 20–28px for panels, 12–14px for controls.
- Colors (CSS variables in one theme file): base #070B16, deep #0B1224; primary #2F7BFF; accent cyan #22D3EE; violet glow #7C5CFF (sparingly); text #F1F5FF / secondary #9AA6C3 / muted #5F6B88.
- Status colors ONLY for statuses: green #22C55E (auto-answered / on time), amber #F5B83D (draft / due soon), red #F2555A (ticket / overdue / fraud).
- Fonts: "Manrope" for headings, "Inter" for UI text. Both must support Uzbek Latin (oʻ, gʻ) and Cyrillic.
- Never: neon overload, rainbow gradients, emoji as icons, cluttered layouts, generic "AI startup" look. Restraint = premium.

## Motion rules (smooth, never laggy)
- Animate ONLY `transform` and `opacity`. Never animate width/height/top/left/blur/box-shadow.
- Durations 150–450 ms, spring or easeOut curves. Stagger lists by 30–60 ms.
- Backdrop-filter is expensive: max ~6 blurred surfaces visible at once; never blur large scrolling lists item-by-item (blur the container instead).
- Background aurora: CSS keyframes on transform only, very slow (20–40 s), `will-change: transform`, pauses when tab is hidden.
- Respect `prefers-reduced-motion`: disable non-essential animation.
- Target 60 fps on a mid-range laptop. Lazy-load route pages.

## i18n
- UI languages: Uzbek Latin (default), Uzbek Cyrillic, Russian. All UI strings in `frontend/src/i18n/` dictionaries, never hardcoded in components.

## Code quality
- Small, reusable components in `frontend/src/components/`. Pages in `frontend/src/pages/`.
- Accessible: keyboard focus states, aria labels on icon buttons, sufficient contrast on glass.
- After each task: run `npm run build` and `npm run lint`, fix all errors before finishing.
