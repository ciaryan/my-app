import { PUZZLE_GROUPS, type PuzzleGroup } from '@/data/connections/puzzles';

export interface DailyPuzzle {
  number: number;
  date: string;
  groups: [PuzzleGroup, PuzzleGroup, PuzzleGroup, PuzzleGroup];
  shuffledWords: string[];
}

const EPOCH = '2026-09-12';

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

function hasOverlap(groups: PuzzleGroup[]): boolean {
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const shared = groups[i].overlapTags.some((tag) =>
        groups[j].overlapTags.includes(tag),
      );
      if (shared) return true;
    }
  }
  return false;
}

function selectGroups(
  rand: () => number,
): [PuzzleGroup, PuzzleGroup, PuzzleGroup, PuzzleGroup] | null {
  const byDifficulty = new Map<number, PuzzleGroup[]>();
  for (const g of PUZZLE_GROUPS) {
    const list = byDifficulty.get(g.difficulty) ?? [];
    list.push(g);
    byDifficulty.set(g.difficulty, list);
  }

  for (const [, list] of byDifficulty) {
    shuffle(list, rand);
  }

  const d1 = byDifficulty.get(1) ?? [];
  const d2 = byDifficulty.get(2) ?? [];
  const d3 = byDifficulty.get(3) ?? [];
  const d4 = byDifficulty.get(4) ?? [];

  for (const g1 of d1) {
    for (const g2 of d2) {
      for (const g3 of d3) {
        for (const g4 of d4) {
          const combo = [g1, g2, g3, g4];
          if (hasOverlap(combo)) {
            return combo as [
              PuzzleGroup,
              PuzzleGroup,
              PuzzleGroup,
              PuzzleGroup,
            ];
          }
        }
      }
    }
  }

  return [d1[0], d2[0], d3[0], d4[0]];
}

export function getDailyPuzzle(dateStr?: string): DailyPuzzle {
  const today = dateStr ?? new Date().toISOString().split('T')[0];
  const epochMs = new Date(EPOCH).getTime();
  const todayMs = new Date(today).getTime();
  const puzzleNumber = Math.floor((todayMs - epochMs) / 86_400_000) + 1;

  const seed = hashString(today);
  const rand = seededRandom(seed);

  const groups = selectGroups(rand)!;
  const allWords = groups.flatMap((g) => g.words);
  const shuffledWords = shuffle(allWords, rand);

  return { number: puzzleNumber, date: today, groups, shuffledWords };
}
