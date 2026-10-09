// Fetches yesterday's most-read English Wikipedia articles from the daily
// "featured" feed (CC BY-SA 4.0). They change every day and lean towards
// films, TV, music, sport and celebrities — good pub quiz material.

import { addDays } from '@/lib/quiz/dates';
import { GRIM, type OnThisDayItem } from './onthisday';

const FEED_URL = 'https://en.wikipedia.org/api/rest_v1/feed/featured';
const USER_AGENT =
  'ciaryan.com-news-quiz/1.0 (https://ciaryan.com; daily quiz generator)';
const MAX_EXTRACT_CHARS = 500;

/** Pages that aren't about one quizzable subject. */
const NOT_A_SUBJECT =
  /^(Deaths in|List of|Lists of|Main Page|Special:|Wikipedia:|Portal:)|filmography|discography|bibliography/i;

interface FeedArticle {
  title: string;
  normalizedtitle?: string;
  description?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
}

async function fetchFeed(date: string) {
  const [y, m, d] = date.split('-');
  const res = await fetch(`${FEED_URL}/${y}/${m}/${d}`, {
    headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Featured feed ${res.status} for ${date}`);
  return (await res.json()) as { mostread?: { articles?: FeedArticle[] } };
}

/**
 * Most-read articles as quiz items. `date` is today (YYYY-MM-DD); the feed
 * for a date lists the previous day's most read. Falls back a day if that
 * list isn't published yet.
 */
export async function fetchMostRead(date: string): Promise<OnThisDayItem[]> {
  let articles = (await fetchFeed(date)).mostread?.articles;
  if (!articles?.length) {
    articles = (await fetchFeed(addDays(date, -1))).mostread?.articles ?? [];
  }
  const year = Number(date.slice(0, 4));
  // "(1951–2026)" in a description means the person died very recently.
  const recentDeath = new RegExp(`–(${year}|${year - 1})\\)`);

  const items: OnThisDayItem[] = [];
  for (const a of articles) {
    const title = a.normalizedtitle ?? a.title.replace(/_/g, ' ');
    const url = a.content_urls?.desktop?.page;
    const description = a.description ?? '';
    const lead = a.extract ?? '';
    if (!url?.startsWith('https://en.wikipedia.org/') || lead.length < 100) {
      continue;
    }
    if (NOT_A_SUBJECT.test(title)) continue;
    if (GRIM.test(`${title} ${description}`) || GRIM.test(lead.slice(0, 300))) {
      continue;
    }
    if (recentDeath.test(description)) continue;

    let extract = lead;
    if (extract.length > MAX_EXTRACT_CHARS) {
      const cut = extract.lastIndexOf('. ', MAX_EXTRACT_CHARS);
      extract = extract.slice(0, cut > 0 ? cut + 1 : MAX_EXTRACT_CHARS);
    }
    items.push({
      id: `popular-${items.length + 1}`,
      kind: 'popular',
      year: 0,
      text: description,
      leadLength: lead.length,
      page: {
        title,
        ...(description ? { description } : {}),
        extract,
        url,
      },
    });
  }
  return items;
}
