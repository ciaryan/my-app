import type { QuizQuestion } from './schema';

/** Longest run of consecutive words copied verbatim from the source we allow. */
export const MAX_COPIED_WORDS = 7;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Length of the longest common run of consecutive words between a and b. */
export function longestCommonWordRun(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  let best = 0;
  let prev = new Array<number>(wb.length + 1).fill(0);
  for (let i = 1; i <= wa.length; i++) {
    const cur = new Array<number>(wb.length + 1).fill(0);
    for (let j = 1; j <= wb.length; j++) {
      if (wa[i - 1] === wb[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
}

/** Returns problems with a question's originality, or an empty array. */
export function originalityProblems(q: QuizQuestion): string[] {
  const problems: string[] = [];
  const fields: [string, string][] = [
    ['question', q.question],
    ['explanation', q.explanation],
  ];
  for (const [name, text] of fields) {
    const run = longestCommonWordRun(text, q.context);
    if (run > MAX_COPIED_WORDS) {
      problems.push(`${name} copies ${run} consecutive words from the source`);
    }
  }
  return problems;
}
