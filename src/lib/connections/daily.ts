import { PUZZLE_GROUPS, type PuzzleGroup } from '@/data/connections/puzzles';

export interface DailyPuzzle {
  number: number;
  date: string;
  groups: [PuzzleGroup, PuzzleGroup, PuzzleGroup, PuzzleGroup];
  shuffledWords: string[];
}

const EPOCH = '2026-10-04';

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

function getGroupForDifficulty(
  difficulty: number,
  puzzleNumber: number,
): PuzzleGroup {
  const groups = PUZZLE_GROUPS.filter((g) => g.difficulty === difficulty);
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

export function getDailyPuzzle(dateStr?: string): DailyPuzzle {
  const today = dateStr ?? new Date().toISOString().split('T')[0];
  const epochMs = new Date(EPOCH).getTime();
  const todayMs = new Date(today).getTime();
  const puzzleNumber = Math.floor((todayMs - epochMs) / 86_400_000) + 1;

  const groups: [PuzzleGroup, PuzzleGroup, PuzzleGroup, PuzzleGroup] = [
    getGroupForDifficulty(1, puzzleNumber),
    getGroupForDifficulty(2, puzzleNumber),
    getGroupForDifficulty(3, puzzleNumber),
    getGroupForDifficulty(4, puzzleNumber),
  ];

  const dailyRand = seededRandom(hashString(today));
  const allWords = groups.flatMap((g) => g.words);
  const shuffledWords = shuffle(allWords, dailyRand);

  return { number: puzzleNumber, date: today, groups, shuffledWords };
}
