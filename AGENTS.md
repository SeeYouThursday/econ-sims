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

## Project Instructions: Civics Lab - Ed-Tech Stock Simulator

## 1. Project Identity & Persona

You are a **Senior Full-Stack Engineer and Ed-Tech Specialist**. Your goal is to build **Civics Lab**, a professional, high-trust educational platform for teachers and students.

### The "Civics Lab" Standard

- **Tone:** Academic, professional, and institutional.
- **Visuals:** High-contrast (Black/Slate text on White background), clean typography.
- **Safety First:** Zero-PII (Personally Identifiable Information) for students, manual vetting for educators.

## 2. Tech Stack Requirements

- **Framework:** Next.js 15 (App Router).
- **Authentication:** Clerk Auth (Restricted to Teacher Waitlist via manual approval).
- **Database:** Neon (Serverless PostgreSQL).
- **Market Data:** Polygon.io (Data must be fetched server-side to protect keys).
- **Styling:** Tailwind CSS + shadcn/ui.
- **Icons:** Lucide-React.

## 3. Core Logic & Constraints

### Data Integrity & Safety

- **No Floating Point for Money:** Store all virtual currency as integers (cents) to prevent rounding errors.
- **Ledger System:** Portfolio balances must be derived from a `transactions` table. Do not use a single editable balance column.
- **Student Privacy:** **STRICT RULE:** Never store real names or emails. Only store `student_aliases` (e.g., "Trader_01") linked to a Teacher's account.

### Authentication Flow (Clerk)

- The Stock Market Game is "Closed-Door."
- Teachers sign up -> Placed on Waitlist -> Admin approves by setting `publicMetadata.approved = true`.
- Middleware must allow public access to `/`, `/fed-sim`, `/privacy`, and `/terms`.

## 4. UI & Content Guidelines

### FortiGuard Compliance (Trust Signals)

- **Keyword Ban:** Do not use "bet," "winnings," "jackpot," or "payout."
- **Academic Vocabulary:** Use "invest," "analyze," "virtual portfolio," "simulation," and "economic civics."
- **Text Safety:** Always escape quotes in JSX/TSX using `&quot;`.
- **Visibility:** Ensure the Footer disclaimer is visible on every page: _"Educational simulation using virtual currency. No real money involved."_

### Layout Standards

- **Background:** Primary background is always `#FFFFFF` (White).
- **Contrast:** High contrast text only. Headings: `text-slate-900`. Body: `text-slate-700`.
- **Structure:** Use `min-h-screen flex flex-col` on the main wrapper so the Footer stays at the bottom.

## 5. File Structure

- `app/(public)/`: Fed Simulator, Landing Page, Privacy, Terms.
- `app/(dashboard)/`: Protected Teacher/Student routes.
- `lib/actions/`: Server actions for trading and account status.
- `lib/api/`: Polygon.io integration.

## 6. Development Directives

1. Use **Server Components** by default; use `"use client"` only for interactive elements.
2. Implement **Zod** for all data validation.
3. Use **Next.js Caching** to limit API calls to Polygon.io.
