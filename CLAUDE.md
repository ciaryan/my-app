# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start dev server (Next.js 16)
- `npm run build` — production build
- `npm run lint` — ESLint (flat config with next/core-web-vitals, next/typescript, prettier)
- `npm run format` — Prettier (single quotes, semicolons, trailing commas)
- `npm run format:check` — check formatting without writing
- `npm run quiz:generate` / `npm run quiz:validate` — news quiz pipeline (see below)
- `npm run trivia:generate` / `npm run trivia:validate` — daily trivia pipeline (see below)

No test framework is configured. Lint should be clean (no errors or warnings).

## Architecture

Personal portfolio site for Ciarán Ryan (ciaryan.com). Next.js 16 App Router with React 19 and the React Compiler enabled (`reactCompiler: true` in next.config.ts).

**Routes:**

- `/` — static portfolio homepage (`src/app/page.tsx`): name, roles, GitHub/LinkedIn links, experience, then a "Play" section linking the games
- `/idle` — client-side idle/clicker game (`src/app/idle/page.tsx`, `'use client'`)
- `/play/connections` — daily Connections puzzle game (`src/app/play/connections/page.tsx`, `'use client'`)
- `/play/news-quiz` — daily news quiz (`src/app/play/news-quiz/`, see below)
- `/play/trivia` — daily "On this day" pub quiz (`src/app/play/trivia/`, see below)

Both quizzes render the shared client component `src/app/play/_components/DailyQuiz.tsx`, configured by props (title, storage key, epoch, share path).

**localStorage in client components:** don't read it in a mount effect and `setState` (the `react-hooks/set-state-in-effect` lint rule errors). Use `useSyncExternalStore` — either to read storage directly (news quiz) or to gate mounting until the client so `useState` initialisers can read it (Connections).

**Styling:** Tailwind CSS v4 via `@tailwindcss/postcss`. Custom design tokens (background, foreground, muted, border, accent) defined as CSS custom properties in `globals.css` with light/dark via `prefers-color-scheme`. Mapped to Tailwind via `@theme inline`. Fonts: Geist Sans and Geist Mono loaded via `next/font/google`.

**Path alias:** `@/*` maps to `./src/*`.

**Connections game:** Master puzzle data lives in `src/data/connections/puzzles.ts` (curated groups with overlap tags for red herrings). Daily selection logic in `src/lib/connections/daily.ts` uses a seeded PRNG keyed on the date. User history stored in localStorage. **Planned:** Replace deterministic selection with an LLM agent (Gemini via Google AI Studio) that composes daily puzzles from the master list with more nuanced cross-category overlap reasoning. Reuse `src/lib/ai/gemini.ts`. Only older Pro models are on the free tier, so expect to use Flash.

**Security headers:** X-Frame-Options, HSTS, etc. configured in `next.config.ts` `headers()`.

## News quiz

Five multiple-choice questions (4 options each) on yesterday's news, regenerated daily by GitHub Actions and deployed by Vercel. It shares only the "daily" idea with Connections, not its UI. Live at https://www.ciaryan.com/play/news-quiz.

**Pipeline** (`scripts/quiz/generate.ts`, run daily at 05:17 UTC by `.github/workflows/daily-quiz.yml`):

1. Fetch yesterday's (UTC) Wikipedia `Portal:Current events/<YYYY Month D>` page via the MediaWiki `action=parse` API (`src/lib/quiz/sources/wikipedia.ts`). Pages keep being edited for a day or two, so never use today's.
2. One Gemini call writes about 12 candidates. Code then shuffles options, attaches URLs from the parsed entry (never from the model), and drops candidates that fail the schema or copy more than 7 consecutive words from their source.
3. One batched Gemini call answers each candidate blind, from only its own source entry. Drop any it gets wrong or calls ambiguous.
4. Pick 5 with a category spread, write atomically. The workflow then runs Prettier, `quiz:validate -- --fresh`, and commits `src/data/quiz/today.json` as github-actions[bot], which triggers a Vercel deploy.

On any failure the script exits non-zero and leaves the previous `today.json`; the page labels a stale quiz with its date. Because the bot commits to `main` daily, pull before starting work.

**Files:**

- `src/lib/ai/gemini.ts` — shared Gemini client (structured JSON output via Zod schemas, retries, model fallback). Build-time scripts only; ESLint blocks importing it (or `@google/genai`) from `src/app`.
- `src/lib/quiz/schema.ts` — Zod schema for the quiz file, shared by the page, generator and validator.
- `src/lib/quiz/checks.ts` (copied-words check), `topics.ts` (topic mix rules), `dates.ts` (Europe/London dates).
- `scripts/quiz/validate.ts` — `npm run quiz:validate`. Checks schema, originality and topic caps; `-- --fresh` also requires today's London date.
- `src/lib/quiz/pipeline.ts` — generator pieces shared with the trivia quiz: `buildQuestion` (shuffle + schema + originality), batched blind `verifyAll`, atomic write, `runGenerator`.
- `src/app/play/news-quiz/page.tsx` (server; parses the JSON at build time, so an invalid file fails the build) renders `DailyQuiz`, which stores answers in localStorage under `news-quiz-history`, keyed by quiz date.

**Rules:**

- **Never feed publisher content (BBC, Guardian, NYT, Irish Times RSS or APIs) into an LLM.** Their terms forbid AI processing or automated summarising (checked Oct 2026). Publisher articles appear only as "read more" links taken from the Wikipedia entry's citations.
- Wikipedia text is CC BY-SA 4.0. Keep the attribution and licence note on the page.
- Questions and explanations must be original, and every question needs a source URL.
- Topic mix (`src/lib/quiz/topics.ts`): at most 1 conflict question (the "Armed conflicts and attacks" category, or a story chain mentioning war/conflict) and exactly 1 sports question. If yesterday has no sports news, sports entries are borrowed from the day before; with none at all the quiz goes ahead without one. The validator enforces the caps.
- Quiz dates use Europe/London. (Connections uses UTC; leave it.)

**Gemini config and quota:**

- `GEMINI_API_KEY` is an Actions repository secret; `GEMINI_MODEL` (currently `gemini-3.8-flash`) is a repository variable. Never use a `NEXT_PUBLIC_` prefix and never add them to Vercel; the site never calls Gemini at runtime.
- `GEMINI_FALLBACK_MODEL` (workflow defaults it to `gemini-3.7-flash`) is tried when the main model is overloaded, timing out or out of quota. A model that reports exhausted quota is skipped for the rest of the run. The quiz file's `model` field records which model(s) were used.
- The free tier allows about 20 requests/day per model, and each model has its own quota (it reset around midnight UK time when tested Oct 2026). A run makes 2 calls, so keep verification batched. Daily-quota 429s fail fast; only 5xx, timeouts and short rate-limit waits are retried.

**Running locally:**

- Put `GEMINI_API_KEY` and `GEMINI_MODEL` (optionally `GEMINI_FALLBACK_MODEL`) in `.env.local`, which is git-ignored; `quiz:generate` loads it. GitHub secrets can't be read locally.
- Each local run uses real quota and overwrites `today.json`. Review the file before committing it.
- To test pipeline logic without quota, run `generate.ts` from a throwaway script that replaces `globalThis.fetch` for `generativelanguage.googleapis.com` with canned responses (the SDK uses global fetch), then `require('./generate')`. Back up `today.json` first.
- Scripts run with `tsx` (CommonJS output, so no top-level await; wrap code in `main()`).
- Workflows can only be started by hand from the Actions tab once they exist on `main`.

## Daily trivia

Five pub quiz questions from different rounds on what happened on today's date, built on the same pipeline as the news quiz. Live at https://www.ciaryan.com/play/trivia.

- Source: Wikipedia's "On this day" feed (`https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/MM/DD`, CC BY-SA 4.0), parsed in `src/lib/quiz/sources/onthisday.ts`. It uses selected anniversaries, events and up to 30 notable births (filtered to pub-quiz professions, ranked by article lead length as a fame proxy). Violent or tragic entries are filtered out. Extracts are trimmed to 300 characters to keep the prompt small, because larger prompts hit 504 timeouts.
- `scripts/trivia/generate.ts` runs daily at 05:37 UTC via `.github/workflows/daily-trivia.yml`, after the news quiz, and writes `src/data/trivia/today.json` (`TriviaFileSchema`). It uses the same Gemini models, fallback and 2-calls-per-run budget as the news quiz.
- Rounds (`src/lib/quiz/trivia.ts`): Gemini tags each question with one of Royalty, Film, Music, TV, Sport, History, Science, Geography, Literature or Art. The picker takes 5 different rounds, filling Royalty, Film and Music first when available. `trivia:validate` checks schema, originality and distinct, known rounds; `-- --fresh` also requires today's date.
- Questions link to the Wikipedia article only (`readMore` is unset). The page stores answers under `trivia-history`.
