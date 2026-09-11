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
