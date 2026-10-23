import {
  ORIGINAL_GROUPS,
  PUZZLE_GROUPS,
  type PuzzleGroup,
} from '@/data/connections/puzzles';

export interface DailyPuzzle {
  number: number;
  date: string;
  groups: [PuzzleGroup, PuzzleGroup, PuzzleGroup, PuzzleGroup];
  shuffledWords: string[];
}

const EPOCH = '2026-10-04';
// Days before this used the legacy cycle through ORIGINAL_GROUPS; keep it so
// past puzzles don't change. From here on each slot takes the least recently
// used group, so new groups are all used before any old one repeats.
const LRU_FROM = '2026-10-24';
const DAY_MS = 86_400_000;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function legacyGroupForDifficulty(
  difficulty: number,
  puzzleNumber: number,
): PuzzleGroup {
  const groups = ORIGINAL_GROUPS.filter((g) => g.difficulty === difficulty);
  const count = groups.length;
  const cycle = Math.floor((puzzleNumber - 1) / count);
  const idx = (puzzleNumber - 1) % count;

  const seed = hashString(EPOCH) ^ (difficulty * 7919 + cycle * 104729);
  const shuffled = shuffle(groups, seededRandom(seed));

  if (cycle > 0 && idx === 0) {
    const prevSeed =
      hashString(EPOCH) ^ (difficulty * 7919 + (cycle - 1) * 104729);
    const prevShuffled = shuffle(groups, seededRandom(prevSeed));
    if (shuffled[0].id === prevShuffled[count - 1].id) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }
  }

  return shuffled[idx];
}

type Groups = [PuzzleGroup, PuzzleGroup, PuzzleGroup, PuzzleGroup];

function dateForPuzzle(puzzleNumber: number): string {
  const ms = new Date(EPOCH).getTime() + (puzzleNumber - 1) * DAY_MS;
  return new Date(ms).toISOString().split('T')[0];
}

function lruGroups(date: string, lastUsed: Map<string, number>): Groups {
  const picked: PuzzleGroup[] = [];
  const words = new Set<string>();
  for (const difficulty of [1, 2, 3, 4]) {
    const available = PUZZLE_GROUPS.filter(
      (g) => g.difficulty === difficulty && (g.addedOn ?? '') <= date,
    );
    // No word may appear twice on the board.
    const clashFree = available.filter(
      (g) => !g.words.some((w) => words.has(w.toLowerCase())),
    );
    const pool = clashFree.length > 0 ? clashFree : available;
    const ranked = pool
      .map((g) => ({
        g,
        last: lastUsed.get(g.id) ?? 0,
        tie: hashString(`${date}:${g.id}`),
      }))
      .sort((a, b) => a.last - b.last || a.tie - b.tie);
    const group = ranked[0].g;
    picked.push(group);
    for (const w of group.words) words.add(w.toLowerCase());
  }
  return picked as Groups;
}

// Puzzle n depends on every earlier day's picks, so replay from the epoch.
const schedule: Groups[] = [];
const lastUsed = new Map<string, number>();

function groupsForPuzzle(puzzleNumber: number): Groups {
  while (schedule.length < puzzleNumber) {
    const n = schedule.length + 1;
    const date = dateForPuzzle(n);
    const groups =
      date < LRU_FROM
        ? ([1, 2, 3, 4].map((d) => legacyGroupForDifficulty(d, n)) as Groups)
        : lruGroups(date, lastUsed);
    for (const g of groups) lastUsed.set(g.id, n);
    schedule.push(groups);
  }
  return schedule[puzzleNumber - 1];
}

export function getDailyPuzzle(dateStr?: string): DailyPuzzle {
  const today = dateStr ?? new Date().toISOString().split('T')[0];
  const epochMs = new Date(EPOCH).getTime();
  const todayMs = new Date(today).getTime();
  const puzzleNumber = Math.floor((todayMs - epochMs) / DAY_MS) + 1;

  const groups = groupsForPuzzle(puzzleNumber);

  const dailyRand = seededRandom(hashString(today));
  const allWords = groups.flatMap((g) => g.words);
  const shuffledWords = shuffle(allWords, dailyRand);

  return { number: puzzleNumber, date: today, groups, shuffledWords };
}
