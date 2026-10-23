// Prints a prompt for writing new Connections groups in Gemini (or any chat
// model), listing every existing group so it doesn't repeat them.
//   npm run -s connections:prompt -- 10 | pbcopy   (10 groups per colour)

import { PUZZLE_GROUPS } from '@/data/connections/puzzles';
import { MAX_WORD_LENGTH } from '@/lib/connections/checks';

const COLOURS = ['', 'Yellow', 'Green', 'Blue', 'Purple'];

function main() {
  const perDifficulty = Number(process.argv[2] ?? 10);
  if (!Number.isInteger(perDifficulty) || perDifficulty < 1) {
    throw new Error('Usage: connections:prompt -- <groups per difficulty>');
  }

  const existing = [1, 2, 3, 4]
    .map((d) => {
      const lines = PUZZLE_GROUPS.filter((g) => g.difficulty === d).map(
        (g) => `- ${g.category}: ${g.words.join(', ')}`,
      );
      return `${COLOURS[d]} (difficulty ${d}):\n${lines.join('\n')}`;
    })
    .join('\n\n');

  const example = PUZZLE_GROUPS.find((g) => g.id === 'irish-blank')!;
  const exampleJson = JSON.stringify(
    {
      id: example.id,
      category: example.category,
      difficulty: example.difficulty,
      words: example.words,
      overlapTags: example.overlapTags,
    },
    null,
    2,
  );

  console.log(`You are writing groups for a daily word game like the New York Times' Connections, played by a casual audience in Ireland and the UK (think pub quiz regulars, not puzzle experts). Each day's board shows 16 words. Players sort them into four groups of four, one group per colour.

Write ${perDifficulty * 4} NEW groups: exactly ${perDifficulty} for each difficulty.

## Difficulties

1. Yellow (easiest): a plain category most people get at once. Example: "Herbs": Sage, Basil, Rosemary, Thyme.
2. Green: a common category that needs a little knowledge or has a sneaky member. Example: "Royal residences": Balmoral, Windsor, Sandringham, Buckingham.
3. Blue: specialist knowledge, slang or culture, or a category that's easy to mistake for another. Example: "Northern English slang": Nowt, Owt, Mardy, Ginnel.
4. Purple (hardest): wordplay rather than meaning, e.g. hidden words, "___ bridge", anagrams, homophones, first words of titles. Example: "Words hiding a colour": Boredom, Standard, Blimey, Plumage.

## Rules

- Exactly four words per group. Each is one or two words, at most ${MAX_WORD_LENGTH} characters, in Title Case, using normal spelling (Irish fadas are fine).
- Everything must be true. If you aren't certain all four members are correct, drop the group and write a different one. No obscure trivia: a typical adult in Ireland or the UK should be able to recognise each word as belonging once the category is revealed.
- The category label must be specific enough that exactly these four fit it fairly. For wordplay groups, the trick must work for all four words with no exceptions.
- Mix themes: roughly a third Irish, a third British and a third general or international (food, sport, music, TV and film, places, history, language, everyday objects). Don't write several groups on the same theme.
- Red herrings make the game fun. Prefer words that could plausibly belong to another category (e.g. "Cork" is a county, a material and a stopper). List these other meanings as short lowercase tags in "overlapTags".
- Keep it light. Nothing violent, tragic, political-attack, crude or offensive.
- Do NOT repeat or lightly reword any category below, and do NOT use any of the words already used below. Even one reused word should be rare.

## Already used (do not repeat)

${existing}

## Output

Return ONLY a JSON array, with no commentary and no Markdown code fence. Each item looks exactly like this:

${exampleJson}

"id" is a short unique kebab-case slug for the category. "difficulty" is the number 1–4. Before answering, check every group again: are all four words correct? Does the category fit all four and only those four? Are any words or categories in the "Already used" list? Replace any group that fails.`);
}

main();
