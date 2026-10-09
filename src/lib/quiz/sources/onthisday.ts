// Fetches Wikipedia's "On this day" feed (CC BY-SA 4.0): selected
// anniversaries, events and notable births for a calendar date.

const FEED_URL = 'https://en.wikipedia.org/api/rest_v1/feed/onthisday/all';
const USER_AGENT =
  'ciaryan.com-news-quiz/1.0 (https://ciaryan.com; daily quiz generator)';
const MAX_EXTRACT_CHARS = 300;
/** Births kept, longest lead extracts first (a rough proxy for fame). */
const MAX_BIRTHS = 30;

/** Births are numerous; keep the people pub quizzes ask about. */
const PUB_QUIZ_PEOPLE =
  /\b(king|queen|prince|princess|monarch|emperor|empress|duke|duchess|singer|songwriter|musician|rapper|composer|guitarist|drummer|band|actor|actress|film|director|comedian|television|presenter|footballer|cricketer|golfer|boxer|tennis|athlete|racing|novelist|author|poet|playwright|painter|artist|sculptor|physicist|chemist|astronaut|inventor|explorer|prime minister|president)\b/i;

/** Skip entries about violence and tragedy — not pub quiz material. */
const GRIM =
  /\b(murder\w*|massacre\w*|killed|killing|kills|bomb\w*|shooting|shot dead|terror\w*|genocide|execut\w*|crash\w*|disaster\w*|earthquake|abduct\w*|assassinat\w*)\b/i;

export type OnThisDayKind = 'selected' | 'event' | 'birth';

export interface OnThisDayItem {
  id: string;
  kind: OnThisDayKind;
  year: number;
  text: string;
  /** Main linked article: title, short description and lead extract. */
  page: { title: string; description?: string; extract: string; url: string };
  /** Full length of the article's lead before trimming. */
  leadLength: number;
}

interface FeedEntry {
  text: string;
  year: number;
  pages?: {
    titles?: { normalized?: string };
    title: string;
    description?: string;
    extract?: string;
    content_urls?: { desktop?: { page?: string } };
  }[];
}

function toItem(
  entry: FeedEntry,
  kind: OnThisDayKind,
  id: string,
): OnThisDayItem | null {
  // For births the person is usually the first page; for events, the
  // most specific article tends to come first too.
  const page = entry.pages?.find((p) => p.extract && p.content_urls?.desktop);
  const url = page?.content_urls?.desktop?.page;
  if (!page || !url?.startsWith('https://en.wikipedia.org/')) return null;
  if (GRIM.test(entry.text)) return null;
  if (kind === 'birth' && !PUB_QUIZ_PEOPLE.test(entry.text)) return null;
  const lead = page.extract ?? '';
  let extract = lead;
  if (extract.length > MAX_EXTRACT_CHARS) {
    const cut = extract.lastIndexOf('. ', MAX_EXTRACT_CHARS);
    extract = extract.slice(0, cut > 0 ? cut + 1 : MAX_EXTRACT_CHARS);
  }
  return {
    id,
    kind,
    year: entry.year,
    text: entry.text,
    leadLength: lead.length,
    page: {
      title: page.titles?.normalized ?? page.title.replace(/_/g, ' '),
      ...(page.description ? { description: page.description } : {}),
      extract,
      url,
    },
  };
}

/** Feed items for a YYYY-MM-DD date (only month and day are used). */
export async function fetchOnThisDay(date: string): Promise<OnThisDayItem[]> {
  const [, mm, dd] = date.split('-');
  const res = await fetch(`${FEED_URL}/${mm}/${dd}`, {
    headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok)
    throw new Error(`On this day feed ${res.status} for ${mm}/${dd}`);
  const body = (await res.json()) as Partial<Record<string, FeedEntry[]>>;

  const items: OnThisDayItem[] = [];
  const seen = new Set<string>();
  const groups: [string, OnThisDayKind][] = [
    ['selected', 'selected'],
    ['events', 'event'],
    ['births', 'birth'],
  ];
  for (const [key, kind] of groups) {
    for (const [i, entry] of (body[key] ?? []).entries()) {
      const item = toItem(entry, kind, `${kind}-${i + 1}`);
      // The same article often appears in both "selected" and "events".
      if (item && !seen.has(item.page.url)) {
        seen.add(item.page.url);
        items.push(item);
      }
    }
  }
  const births = items
    .filter((i) => i.kind === 'birth')
    .sort((a, b) => b.leadLength - a.leadLength)
    .slice(0, MAX_BIRTHS);
  return items.filter((i) => i.kind !== 'birth').concat(births);
}

/** The text a question must be answerable from. */
export function itemContext(item: OnThisDayItem): string {
  const who = item.page.description
    ? `${item.page.title} (${item.page.description})`
    : item.page.title;
  return `On this day in ${item.year}: ${item.text}\n${who}: ${item.page.extract}`;
}
