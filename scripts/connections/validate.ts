// Checks every Connections group, then plays the schedule forward to report
// how long each difficulty lasts before a group repeats.
//   npm run connections:validate [-- --days 90]
// A repeat means a group that has appeared before (today included).

import { PUZZLE_GROUPS } from '@/data/connections/puzzles';
import { GroupSchema, overlapProblems } from '@/lib/connections/checks';
import { getDailyPuzzle } from '@/lib/connections/daily';

const DAY_MS = 86_400_000;

function main() {
  const errors: string[] = [];

  for (const [i, group] of PUZZLE_GROUPS.entries()) {
    const parsed = GroupSchema.safeParse(group);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${group.id}: ${issue.path.join('.')}: ${issue.message}`);
      }
    }
    // Only errors: the launch set already reuses some single words.
    for (const e of overlapProblems(group, PUZZLE_GROUPS.slice(0, i)).errors) {
      errors.push(`${group.id}: ${e}`);
    }
  }

  const daysArg = process.argv.indexOf('--days');
  const days = daysArg === -1 ? 90 : Number(process.argv[daysArg + 1]);
  const today = getDailyPuzzle();
  const seen = new Set<string>();
  // Groups up to and including today count as used.
  for (let n = 1; n <= today.number; n++) {
    const date = new Date(Date.parse(today.date) - (today.number - n) * DAY_MS)
      .toISOString()
      .split('T')[0];
    for (const g of getDailyPuzzle(date).groups) seen.add(g.id);
  }
  const freshUntil: (string | undefined)[] = [];
  for (let i = 1; i <= days; i++) {
    const date = new Date(Date.parse(today.date) + i * DAY_MS)
      .toISOString()
      .split('T')[0];
    const puzzle = getDailyPuzzle(date);
    const words = new Set(puzzle.shuffledWords.map((w) => w.toLowerCase()));
    if (words.size !== 16) errors.push(`${date}: a word appears twice`);
    for (const g of puzzle.groups) {
      if (seen.has(g.id) && freshUntil[g.difficulty] === undefined) {
        freshUntil[g.difficulty] = date;
      }
      seen.add(g.id);
    }
  }

  for (const d of [1, 2, 3, 4]) {
    const total = PUZZLE_GROUPS.filter((g) => g.difficulty === d).length;
    const repeat = freshUntil[d];
    console.log(
      `Difficulty ${d}: ${total} groups, ${repeat ? `first repeat on ${repeat}` : `no repeats in the next ${days} days`}`,
    );
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} problem(s):`);
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }
  console.log(`\nOK: ${PUZZLE_GROUPS.length} groups.`);
}

main();
