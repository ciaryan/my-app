// Topic rules for the daily mix: at most one conflict question and exactly
// one sports question (when there is any sports news to ask about).

export const MAX_CONFLICT_QUESTIONS = 1;
export const SPORTS_QUESTIONS = 1;

const CONFLICT_CATEGORY = 'Armed conflicts and attacks';
const SPORTS_CATEGORY = 'Sports';
const CONFLICT_STORY =
  /\b(wars?|conflicts?|insurgency|invasion|military buildup)\b/i;

/**
 * True for the conflict category, or any entry filed under a war/conflict
 * story (e.g. "International relations" news about the Russo-Ukrainian war).
 * `story` is the topic chain only, not the entry text, so passing mentions
 * of "war" in unrelated news don't count.
 */
export function isConflict(category: string, story: string): boolean {
  return category === CONFLICT_CATEGORY || CONFLICT_STORY.test(story);
}

export function isSports(category: string): boolean {
  return category === SPORTS_CATEGORY;
}
