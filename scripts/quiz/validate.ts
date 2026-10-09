// Validates src/data/quiz/today.json. Run with --fresh to also require that
// the quiz is dated today (Europe/London) — the daily workflow does this.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { originalityProblems } from '@/lib/quiz/checks';
import { londonDate } from '@/lib/quiz/dates';
import { QuizFileSchema } from '@/lib/quiz/schema';

const QUIZ_PATH = path.join(process.cwd(), 'src/data/quiz/today.json');

async function main() {
  const fresh = process.argv.includes('--fresh');
  const errors: string[] = [];

  const raw = await readFile(QUIZ_PATH, 'utf8');
  const result = QuizFileSchema.safeParse(JSON.parse(raw));
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
  } else {
    const quiz = result.data;
    if (fresh && quiz.date !== londonDate()) {
      errors.push(`date is ${quiz.date}, expected ${londonDate()}`);
    }
    if (quiz.newsDate > quiz.date) {
      errors.push(`newsDate ${quiz.newsDate} is after date ${quiz.date}`);
    }
    for (const q of quiz.questions) {
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
  console.log('[quiz] today.json is valid');
}

main().catch((err: unknown) => {
  console.error(
    `[quiz] validation failed: ${err instanceof Error ? err.message : err}`,
  );
  process.exit(1);
});
