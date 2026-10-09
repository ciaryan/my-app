// Validates src/data/trivia/today.json. Run with --fresh to also require that
// the quiz is dated today (Europe/London) — the daily workflow does this.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { originalityProblems } from '@/lib/quiz/checks';
import { londonDate } from '@/lib/quiz/dates';
import { TriviaFileSchema } from '@/lib/quiz/schema';
import { TRIVIA_CATEGORIES } from '@/lib/quiz/trivia';

const QUIZ_PATH = path.join(process.cwd(), 'src/data/trivia/today.json');

async function main() {
  const fresh = process.argv.includes('--fresh');
  const errors: string[] = [];

  const raw = await readFile(QUIZ_PATH, 'utf8');
  const result = TriviaFileSchema.safeParse(JSON.parse(raw));
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
  } else {
    const quiz = result.data;
    if (fresh && quiz.date !== londonDate()) {
      errors.push(`date is ${quiz.date}, expected ${londonDate()}`);
    }
    const categories = quiz.questions.map((q) => q.category);
    if (new Set(categories).size !== categories.length) {
      errors.push(`rounds repeat: ${categories.join(', ')}`);
    }
    for (const q of quiz.questions) {
      if (!(TRIVIA_CATEGORIES as readonly string[]).includes(q.category)) {
        errors.push(`${q.id}: unknown round "${q.category}"`);
      }
      for (const problem of originalityProblems(q)) {
        errors.push(`${q.id}: ${problem}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error(
      `[quiz] ${path.relative(process.cwd(), QUIZ_PATH)} is invalid:`,
    );
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('[quiz] trivia today.json is valid');
}

main().catch((err: unknown) => {
  console.error(
    `[quiz] validation failed: ${err instanceof Error ? err.message : err}`,
  );
  process.exit(1);
});
