// Pub quiz rounds for the daily trivia. Each quiz uses five different ones.

export const TRIVIA_CATEGORIES = [
  'Royalty',
  'Film',
  'Music',
  'TV',
  'Sport',
  'History',
  'Science',
  'Geography',
  'Literature',
  'Art',
] as const;

export type TriviaCategory = (typeof TRIVIA_CATEGORIES)[number];

/** Rounds to include whenever the day offers a usable question for them. */
export const PREFERRED_CATEGORIES: TriviaCategory[] = [
  'Royalty',
  'Film',
  'Music',
];
