// Validates src/data/trivia/today.json. Run with --fresh to also require that
// the quiz is dated today (Europe/London) — the daily workflow does this.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { originalityProblems } from '@/lib/quiz/checks';
import { londonDate } from '@/lib/quiz/dates';
import { TriviaFileSchema } from '@/lib/quiz/schema';
import {
  MOST_READ,
  ON_THIS_DAY,
  ON_THIS_DAY_QUESTIONS,
  ON_THIS_DAY_WORDING,
  TRIVIA_CATEGORIES,
} from '@/lib/quiz/trivia';

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
    const onThisDay = quiz.questions.filter((q) => q.story === ON_THIS_DAY);
    if (onThisDay.length !== ON_THIS_DAY_QUESTIONS) {
      errors.push(
        `${onThisDay.length} On this day questions, expected ${ON_THIS_DAY_QUESTIONS}`,
      );
    }
    for (const q of quiz.questions) {
      if (q.story === ON_THIS_DAY && !ON_THIS_DAY_WORDING.test(q.question)) {
        errors.push(`${q.id}: On this day question doesn't say "on this day"`);
      }
      if (q.story !== ON_THIS_DAY && q.story !== MOST_READ) {
        errors.push(`${q.id}: unknown source "${q.story}"`);
      }
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
