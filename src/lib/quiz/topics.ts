// Topic rules for the daily mix: at most one heavy question (conflict or
// disaster) and exactly one sports question (when there is any sports news).

export const MAX_HEAVY_QUESTIONS = 1;
export const SPORTS_QUESTIONS = 1;

const HEAVY_CATEGORIES = new Set([
  'Armed conflicts and attacks',
  'Disasters and accidents',
]);
const SPORTS_CATEGORY = 'Sports';
const CONFLICT_STORY =
  /\b(wars?|conflicts?|insurgency|invasion|military buildup)\b/i;

/**
 * True for the conflict and disaster categories, or any entry filed under a
 * war/conflict story (e.g. "International relations" news about the
 * Russo-Ukrainian war). Keeps the quiz's tone light: at most one of these.
 * `story` is the topic chain only, not the entry text, so passing mentions
 * of "war" in unrelated news don't count.
 */
export function isHeavy(category: string, story: string): boolean {
  return HEAVY_CATEGORIES.has(category) || CONFLICT_STORY.test(story);
}

export function isSports(category: string): boolean {
  return category === SPORTS_CATEGORY;
}
