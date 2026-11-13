// Pirate Studios rehearsal room availability, from the public search API that
// book.pirate.com uses. Unofficial, so keep request volume low.

const API = 'https://api.pirate.com/v1/search';

export const SITES = [
  { slug: 'london-dalston', name: 'Dalston' },
  { slug: 'london-camden', name: 'Camden' },
  { slug: 'london-hackney', name: 'Hackney' },
  { slug: 'london-lydden-road-earlsfield', name: 'Earlsfield' },
  { slug: 'london-greenwich-bugsby-s-way', name: 'Greenwich' },
  { slug: 'london-brixton', name: 'Brixton' },
  { slug: 'london-notting-hill-the-arches', name: 'Notting Hill' },
] as const;

export const TIERS = ['Lite', 'Standard', 'Pro'] as const;
export type Tier = (typeof TIERS)[number];

export const DAYS_AHEAD = 21;
/** London hours fetched for every day; the page narrows them. 24 = midnight. */
export const HOURS: [number, number] = [7, 24];

/** [startHour, endHour) runs of free hours, with the most rooms free at once. */
export interface Block {
  start: number;
  end: number;
  rooms: number;
}

export interface SiteDay {
  slug: string;
  name: string;
  tiers: Record<Tier, Block[]>;
}

export interface Day {
  date: string;
  weekend: boolean;
  sites: SiteDay[];
}

export interface Availability {
  fetchedAt: string;
  days: Day[];
  errors: string[];
}

interface SearchResult {
  studio: { name: string };
  studio_type: { name: string; studio_supertype: { name: string } };
  slots: { time: string; available: boolean }[];
}

const londonParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

function toLondon(date: Date) {
  const p = Object.fromEntries(
    londonParts.formatToParts(date).map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour),
    weekday: p.weekday,
  };
}

function upcomingDates(): { date: string; weekend: boolean }[] {
  const now = Date.now();
  return Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const { date, weekday } = toLondon(new Date(now + i * 86_400_000));
    return { date, weekend: weekday === 'Sat' || weekday === 'Sun' };
  });
}

async function search(slug: string, date: string): Promise<SearchResult[]> {
  // Slots run from 3 hours before start_time to ~24 hours after, so a 10:00
  // search covers 07:00 to midnight.
  const params = new URLSearchParams({
    deck_slug: slug,
    duration: '1',
    start_time: `${date}T10:00:00.000`,
  });
  const res = await fetch(`${API}?${params}`, {
    headers: {
      accept: 'application/json',
      'accept-language': 'en',
      origin: 'https://book.pirate.com',
      referer: 'https://book.pirate.com/',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function tierOf(result: SearchResult): Tier | null {
  if (result.studio_type.studio_supertype.name !== 'Rehearsal') return null;
  const tier = result.studio_type.name.replace(/^Rehearsal /, '');
  return (TIERS as readonly string[]).includes(tier) ? (tier as Tier) : null;
}

function summarise(
  results: SearchResult[],
  date: string,
  [from, to]: [number, number],
): Record<Tier, Block[]> {
  const free = Object.fromEntries(
    TIERS.map((t) => [t, new Array<number>(24).fill(0)]),
  ) as Record<Tier, number[]>;
  for (const result of results) {
    const tier = tierOf(result);
    if (!tier) continue;
    for (const slot of result.slots) {
      if (!slot.available) continue;
      const local = toLondon(new Date(slot.time));
      if (local.date === date && local.hour >= from && local.hour < to) {
        free[tier][local.hour]++;
      }
    }
  }
  return Object.fromEntries(
    TIERS.map((tier) => {
      const blocks: Block[] = [];
      for (let h = from; h < to; h++) {
        const rooms = free[tier][h];
        if (!rooms) continue;
        const last = blocks.at(-1);
        if (last && last.end === h) {
          last.end = h + 1;
          last.rooms = Math.max(last.rooms, rooms);
        } else {
          blocks.push({ start: h, end: h + 1, rooms });
        }
      }
      return [tier, blocks];
    }),
  ) as Record<Tier, Block[]>;
}

/** Runs `fn` over `items` with at most `limit` in flight. */
async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

export async function fetchAvailability(): Promise<Availability> {
  const dates = upcomingDates();
  const jobs = dates.flatMap((d) => SITES.map((site) => ({ ...d, site })));
  const errors: string[] = [];

  const results = await pool(jobs, 4, async (job): Promise<SiteDay | null> => {
    try {
      const results = await search(job.site.slug, job.date);
      return {
        slug: job.site.slug,
        name: job.site.name,
        tiers: summarise(results, job.date, HOURS),
      };
    } catch (err) {
      // Node's "fetch failed" hides the useful part (e.g. a TLS error) in cause.
      const cause = (err as Error).cause as { code?: string } | undefined;
      errors.push(
        `${job.site.name} ${job.date}: ${cause?.code ?? (err as Error).message}`,
      );
      return null;
    }
  });

  const days = dates.map((d, i) => ({
    date: d.date,
    weekend: d.weekend,
    sites: results
      .slice(i * SITES.length, (i + 1) * SITES.length)
      .filter((s): s is SiteDay => s !== null),
  }));

  return { fetchedAt: new Date().toISOString(), days, errors };
}
