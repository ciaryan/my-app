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

/** `story` values marking where a trivia question came from. */
export const MOST_READ = 'Most read';
export const ON_THIS_DAY = 'On this day';
/** On this day questions must say so, e.g. "On this day in 1834, …". */
export const ON_THIS_DAY_WORDING = /\b(on|born on) this day\b/i;
/** Days before a Wikipedia article can be used again (with a new question). */
export const REUSE_AFTER_DAYS = 7;
/** Days of question history kept in used.json. */
export const HISTORY_DAYS = 90;
/** Of the five questions, how many come from the On this day feed. */
export const ON_THIS_DAY_QUESTIONS = 1;
