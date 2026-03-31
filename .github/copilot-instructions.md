<!--
This file is generated to help AI coding agents contribute to the SeeYouThursday/econ-sims repository.
It describes the current project shape and the best way to make small, safe changes.
-->

# Copilot instructions for this repository

Repository snapshot

- This is a Next.js 16 app using React 19, TypeScript, Tailwind CSS, and Recharts.
- The application code lives in `app/` and `components/`; shared types are in `types/`.
- There is one API route under `app/api/stock/route.ts` and a stock simulator UI in `components/StockGame.tsx`.
- Use the existing `package.json` scripts: `dev`, `build`, `start`, and `lint`.

What an AI agent should do first

- Read `package.json`, `tsconfig.json`, `next.config.ts`, `app/page.tsx`, and `components/StockGame.tsx`.
- Prefer existing App Router conventions and avoid introducing legacy `pages/` patterns.
- For UI changes, keep work inside `app/`, `components/`, and `public/`.

Scaffolding recommendations (concrete, minimal)

- If new features are requested, implement them in the existing Next.js app structure.
- Do not add a new top-level framework or a full separate backend.
- Add tests only if the user asks and if there is an existing test framework; this repo has no test setup currently.

Development workflows (how to detect and run)

- Use `npm install`, `npm run dev`, `npm run build`, and `npm run lint`.
- If changing TypeScript code, ensure `npm run build` succeeds.
- If changing frontend behavior, verify the app compiles and follow existing styling conventions.

Project conventions and merge guidance

- Keep React components typed, lean, and reusable.
- Use `components/` for standalone UI pieces and `app/` for page routing.
- Keep CSS changes in `app/globals.css` unless adding small component-level styles.
- Avoid breaking changes that require broad refactors across unrelated components.

Integration points & external dependencies

- The repo currently has no external API credentials or database integrations.
- If an integration is needed, document it clearly and use environment variables rather than hard-coded secrets.

Safety notes for the agent

- Do not create secrets in the repository.
- Keep modifications minimal, reviewable, and aligned to the existing Next.js app.
