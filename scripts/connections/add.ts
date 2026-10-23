// Adds groups written from connections:prompt to src/data/connections/added.json.
//   npm run connections:add -- groups.json [--from YYYY-MM-DD] [--dry-run]
// Groups become available from --from (default tomorrow, UTC), so today's
// puzzle never changes. Groups that duplicate existing ones are skipped and
// listed so you can ask for replacements.

import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'prettier';
import { PUZZLE_GROUPS, type PuzzleGroup } from '@/data/connections/puzzles';
import { GroupSchema, overlapProblems } from '@/lib/connections/checks';

const ADDED_PATH = path.join(process.cwd(), 'src/data/connections/added.json');
const DAY_MS = 86_400_000;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith('--')) {
    throw new Error(
      'Usage: connections:add -- <file.json> [--from YYYY-MM-DD] [--dry-run]',
    );
  }
  const dryRun = process.argv.includes('--dry-run');
  const today = new Date().toISOString().split('T')[0];
  const from =
    arg('--from') ?? new Date(Date.now() + DAY_MS).toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || from <= today) {
    throw new Error(`--from must be a date after today (${today})`);
  }

  // Chat models like to wrap JSON in a code fence despite being told not to.
  const raw = (await readFile(file, 'utf8'))
    .trim()
    .replace(/^```(?:json)?\s*/, '')
    .replace(/\s*```$/, '');
  const input: unknown = JSON.parse(raw);
  if (!Array.isArray(input)) throw new Error('Expected a JSON array');

  const accepted: PuzzleGroup[] = [];
  let skipped = 0;
  for (const [i, item] of input.entries()) {
    const label = (item as { id?: string })?.id ?? `#${i + 1}`;
    const parsed = GroupSchema.safeParse(item);
    if (!parsed.success) {
      skipped++;
      const issues = parsed.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      console.log(`✗ ${label}: ${issues.join('; ')}`);
      continue;
    }
    const group: PuzzleGroup = { ...parsed.data, addedOn: from };
    const { errors, warnings } = overlapProblems(group, [
      ...PUZZLE_GROUPS,
      ...accepted,
    ]);
    if (errors.length > 0) {
      skipped++;
      console.log(`✗ ${label}: ${errors.join('; ')}`);
      continue;
    }
    accepted.push(group);
    const note = warnings.length > 0 ? ` (${warnings.join('; ')})` : '';
    console.log(
      `✓ [${group.difficulty}] ${group.category}: ${group.words.join(', ')}${note}`,
    );
  }

  const counts = [1, 2, 3, 4].map(
    (d) => accepted.filter((g) => g.difficulty === d).length,
  );
  console.log(
    `\n${accepted.length} accepted (by difficulty: ${counts.join('/')}), ${skipped} skipped, available from ${from}.`,
  );
  if (dryRun || accepted.length === 0) return;

  const existing = JSON.parse(await readFile(ADDED_PATH, 'utf8'));
  const tmp = `${ADDED_PATH}.tmp`;
  const json = JSON.stringify([...existing, ...accepted]);
  await writeFile(tmp, await format(json, { filepath: ADDED_PATH }));
  await rename(tmp, ADDED_PATH);
  console.log(`Wrote ${path.relative(process.cwd(), ADDED_PATH)}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
