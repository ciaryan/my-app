import { z } from 'zod';
import type { PuzzleGroup } from '@/data/connections/puzzles';

// Longest word that still fits on a tile on a phone ("Uilleann Pipes" is 14).
export const MAX_WORD_LENGTH = 15;

export const GroupSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be kebab-case'),
  category: z.string().min(3),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  words: z
    .tuple([z.string(), z.string(), z.string(), z.string()])
    .refine(
      (ws) => ws.every((w) => w.trim() === w && w.length > 0),
      'words must be non-empty with no surrounding spaces',
    )
    .refine(
      (ws) => ws.every((w) => w.length <= MAX_WORD_LENGTH),
      `words must be at most ${MAX_WORD_LENGTH} characters`,
    )
    .refine(
      (ws) => new Set(ws.map((w) => w.toLowerCase())).size === 4,
      'words must be distinct',
    ),
  overlapTags: z.array(z.string()),
  addedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface Problems {
  errors: string[];
  warnings: string[];
}

/** Ways `group` duplicates or recycles groups already in `others`. */
export function overlapProblems(
  group: PuzzleGroup,
  others: PuzzleGroup[],
): Problems {
  const errors: string[] = [];
  const warnings: string[] = [];
  const words = new Set(group.words.map(normalise));
  for (const other of others) {
    if (other.id === group.id) errors.push(`id already used`);
    if (normalise(other.category) === normalise(group.category)) {
      errors.push(`same category as "${other.id}"`);
    }
    const shared = other.words.filter((w) => words.has(normalise(w)));
    // Two shared words means it's the same idea recycled; one is a fine red
    // herring.
    if (shared.length >= 2) {
      errors.push(`shares ${shared.join(', ')} with "${other.id}"`);
    } else if (shared.length === 1) {
      warnings.push(`reuses "${shared[0]}" from "${other.id}"`);
    }
  }
  return { errors, warnings };
}
