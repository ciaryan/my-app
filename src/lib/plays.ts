// Daily visit counter ("N people have played today" on the games, and the
// /usage history), stored in Upstash Redis via its REST API (no SDK).
// Server-only: the token must never reach the browser.

import { createHash } from 'node:crypto';
import { addDays } from '@/lib/quiz/dates';

/** Counted pages and their labels on /usage. */
export const TRACKED_PAGES = {
  home: 'Home',
  connections: 'Connections',
  'news-quiz': 'News quiz',
  trivia: 'Trivia',
  idle: 'Idle',
} as const;
export type TrackedPage = keyof typeof TRACKED_PAGES;

export function isTrackedPage(value: unknown): value is TrackedPage {
  return typeof value === 'string' && Object.hasOwn(TRACKED_PAGES, value);
}

// Vercel's Upstash integration sets KV_REST_API_*; a direct Upstash setup
// uses UPSTASH_REDIS_REST_*.
function config() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export function playsConfigured(): boolean {
  return config() !== null;
}

type Command = (string | number)[];

async function pipeline(commands: Command[]): Promise<unknown[]> {
  const c = config();
  if (!c) throw new Error('Upstash Redis is not configured');
  const res = await fetch(`${c.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}` },
    body: JSON.stringify(commands),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const results = (await res.json()) as { result?: unknown; error?: string }[];
  return results.map((r) => {
    if (r.error) throw new Error(`Upstash: ${r.error}`);
    return r.result;
  });
}

// Visitor sets are only needed to dedupe within a day; counts are kept.
const VISITORS_TTL_S = 2 * 24 * 60 * 60;
const COUNT_TTL_S = 400 * 24 * 60 * 60;

/**
 * Records a visit and returns today's count of distinct visitors for the
 * page. Visitors are identified by a salted hash of IP and user agent that
 * changes daily, so no IP is stored and they can't be linked across days.
 */
export async function recordPlay(
  page: TrackedPage,
  date: string,
  ip: string,
  userAgent: string,
): Promise<number> {
  const visitor = createHash('sha256')
    .update(`${config()?.token}:${date}:${ip}:${userAgent}`)
    .digest('hex')
    .slice(0, 32);
  const visitorsKey = `plays:${page}:${date}:visitors`;
  const countKey = `plays:${page}:${date}`;
  const [added] = await pipeline([
    ['SADD', visitorsKey, visitor],
    ['EXPIRE', visitorsKey, VISITORS_TTL_S],
  ]);
  if (added === 1) {
    const [count] = await pipeline([
      ['INCR', countKey],
      ['EXPIRE', countKey, COUNT_TTL_S],
    ]);
    return Number(count);
  }
  const [count] = await pipeline([['GET', countKey]]);
  return Number(count ?? 0);
}

/**
 * Daily visitor counts for every tracked page over the `days` days ending on
 * `today`, newest first. Days with no visits are 0.
 */
export async function getHistory(
  today: string,
  days: number,
): Promise<{ date: string; counts: Record<TrackedPage, number> }[]> {
  const pages = Object.keys(TRACKED_PAGES) as TrackedPage[];
  const dates = Array.from({ length: days }, (_, i) => addDays(today, -i));
  const keys = dates.flatMap((d) => pages.map((p) => `plays:${p}:${d}`));
  const [values] = (await pipeline([['MGET', ...keys]])) as [(string | null)[]];
  return dates.map((date, i) => ({
    date,
    counts: Object.fromEntries(
      pages.map((p, j) => [p, Number(values[i * pages.length + j] ?? 0)]),
    ) as Record<TrackedPage, number>,
  }));
}
