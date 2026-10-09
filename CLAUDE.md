# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start dev server (Next.js 16)
- `npm run build` — production build
- `npm run lint` — ESLint (flat config with next/core-web-vitals, next/typescript, prettier)
- `npm run format` — Prettier (single quotes, semicolons, trailing commas)
- `npm run format:check` — check formatting without writing

No test framework is configured.

## Architecture

Personal portfolio site for Ciarán Ryan (ciaryan.com). Next.js 16 App Router with React 19 and the React Compiler enabled (`reactCompiler: true` in next.config.ts).

**Routes:**

- `/` — static portfolio homepage (`src/app/page.tsx`)
- `/idle` — client-side idle/clicker game (`src/app/idle/page.tsx`, `'use client'`)
- `/play/connections` — daily Connections puzzle game (`src/app/play/connections/page.tsx`, `'use client'`)

**Styling:** Tailwind CSS v4 via `@tailwindcss/postcss`. Custom design tokens (background, foreground, muted, border, accent) defined as CSS custom properties in `globals.css` with light/dark via `prefers-color-scheme`. Mapped to Tailwind via `@theme inline`. Fonts: Geist Sans and Geist Mono loaded via `next/font/google`.

**Path alias:** `@/*` maps to `./src/*`.

**Connections game:** Master puzzle data lives in `src/data/connections/puzzles.ts` (curated groups with overlap tags for red herrings). Daily selection logic in `src/lib/connections/daily.ts` uses a seeded PRNG keyed on the date. User history stored in localStorage. **Planned:** Replace deterministic selection with an LLM agent (Gemini Pro via Google AI Studio) that composes daily puzzles from the master list with more nuanced cross-category overlap reasoning.

**Security headers:** X-Frame-Options, HSTS, etc. configured in `next.config.ts` `headers()`.

## News quiz

Multiple-choice quiz (5 questions, 4 options) on yesterday's news, regenerated daily. Shares only the "daily" idea with Connections, not its UI.

- Route: `/play/news-quiz` — server `page.tsx` imports `src/data/quiz/today.json` and renders a client quiz component
- Source: Wikipedia "Portal:Current events/<YYYY Month D>" pages (CC BY-SA 4.0), fetched via the MediaWiki `action=parse` API with a descriptive User-Agent. Pages are keyed by UTC date and keep being edited for a day or two, so use the previous day's page.
- **Do not feed publisher content (BBC, Guardian, NYT, Irish Times RSS or APIs) into an LLM.** Their terms forbid AI processing or automated summarising (checked Oct 2026). Publisher articles may appear only as plain "read more" links taken from the Wikipedia entry's citations.
- Generator: `scripts/quiz/generate.ts`, run daily by `.github/workflows/daily-quiz.yml`. A second Gemini pass checks each answer against its Wikipedia entry and drops unsupported questions.
- `npm run quiz:generate` — fetch current events, call Gemini, write JSON
- `npm run quiz:validate` — schema + content checks; must pass before any commit of quiz data. `-- --fresh` also requires today's date (the workflow uses it).
- Scripts run with `tsx` (CommonJS output, so no top-level await — wrap in `main()`). `quiz:generate` loads `.env.local` if present.
- Gemini client lives in `src/lib/ai/gemini.ts`, shared with the planned Connections agent. Key is `GEMINI_API_KEY` (Actions secret, never NEXT_PUBLIC_, never imported from `src/app`). Model name comes from `GEMINI_MODEL`.
- Questions must be original (no long verbatim runs from the source) and each needs a source URL that was actually fetched. Attribute Wikipedia (CC BY-SA 4.0) on the page.
- Gemini free tier is about 20 requests/day per model (each model has its own quota; it reset around midnight UK time when tested Oct 2026). A run makes 2 calls (generate + one batched verify), so keep it batched. Daily-quota 429s fail fast instead of retrying.
- If generation or validation fails, keep the previous `today.json`.
- Quiz dates use Europe/London. (Connections uses UTC; leave it.)
- Each committed quiz triggers a Vercel production deploy of ciaryan.com.
