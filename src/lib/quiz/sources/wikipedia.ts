// Fetches and parses Wikipedia "Portal:Current events/<date>" pages.
// Text is CC BY-SA 4.0. Publisher links in the entries are citations only —
// we pass their URLs through as "read more" links and never fetch them.

import { parse, type HTMLElement } from 'node-html-parser';

const API_URL = 'https://en.wikipedia.org/w/api.php';
const WIKI_BASE = 'https://en.wikipedia.org';
const USER_AGENT =
  'ciaryan.com-news-quiz/1.0 (https://ciaryan.com; daily quiz generator)';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface Citation {
  publisher: string;
  url: string;
}

export interface CurrentEvent {
  id: string;
  date: string;
  category: string;
  /** Story chain from the outer bullets, e.g. ["Gaza war", "Hostage crisis"]. */
  topics: string[];
  text: string;
  topicUrl?: string;
  citations: Citation[];
  pageUrl: string;
}

export interface CurrentEventsPage {
  date: string;
  title: string;
  url: string;
  revisionId: number;
  events: CurrentEvent[];
}

export function currentEventsTitle(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `Portal:Current events/${y} ${MONTHS[m - 1]} ${d}`;
}

function wikiUrl(title: string): string {
  return `${WIKI_BASE}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))
    .replace(/%2F/g, '/')
    .replace(/%3A/g, ':')}`;
}

function cleanText(text: string): string {
  return text
    .replace(/ /g, ' ')
    .replace(/[​-‍⁠﻿]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

/** Text of a list item without its nested lists or citation links. */
function ownText(li: HTMLElement): string {
  const clone = parse(li.innerHTML);
  for (const el of clone.querySelectorAll('ul, a.external, sup')) el.remove();
  return cleanText(clone.textContent);
}

function firstWikiLink(li: HTMLElement): string | undefined {
  for (const child of li.childNodes) {
    if (!('tagName' in child)) continue;
    const el = child as HTMLElement;
    if (el.tagName !== 'A') continue;
    const href = el.getAttribute('href') ?? '';
    if (href.startsWith('/wiki/') && !el.classList.contains('new')) {
      return `${WIKI_BASE}${href}`;
    }
  }
  return undefined;
}

function citations(li: HTMLElement): Citation[] {
  const out: Citation[] = [];
  for (const a of li.querySelectorAll('a.external')) {
    // Skip citations inside nested lists — they belong to child entries.
    if (a.closest('li') !== li) continue;
    const url = a.getAttribute('href') ?? '';
    if (!url.startsWith('https://')) continue;
    const publisher = cleanText(a.textContent).replace(/^\(|\)$/g, '');
    if (publisher) out.push({ publisher, url: url.replace(/#$/, '') });
  }
  return out;
}

export function parseCurrentEvents(
  html: string,
  date: string,
  pageUrl: string,
): CurrentEvent[] {
  const root = parse(html);
  const content = root.querySelector('.current-events-content');
  if (!content) return [];

  const events: CurrentEvent[] = [];
  let category = 'General';

  const walk = (ul: HTMLElement, topics: string[], topicUrl?: string) => {
    for (const li of ul.childNodes) {
      if (!('tagName' in li) || (li as HTMLElement).tagName !== 'LI') continue;
      const item = li as HTMLElement;
      const nested = item.childNodes.find(
        (c): c is HTMLElement =>
          'tagName' in c && (c as HTMLElement).tagName === 'UL',
      );
      const text = ownText(item);
      const cites = citations(item);

      if (nested) {
        // A topic heading bullet ("Gaza war"), possibly with its own text.
        walk(nested, [...topics, text], firstWikiLink(item) ?? topicUrl);
      } else if (text.length >= 40 && cites.length > 0) {
        events.push({
          id: `${date}-${events.length + 1}`,
          date,
          category,
          topics,
          text,
          topicUrl,
          citations: cites,
          pageUrl,
        });
      }
    }
  };

  for (const node of content.childNodes) {
    if (!('tagName' in node)) continue;
    const el = node as HTMLElement;
    if (el.tagName === 'P') {
      const heading = cleanText(el.textContent);
      if (heading) category = heading;
    } else if (el.tagName === 'UL') {
      walk(el, []);
    }
  }
  return events;
}

export async function fetchCurrentEvents(
  date: string,
): Promise<CurrentEventsPage> {
  const title = currentEventsTitle(date);
  const params = new URLSearchParams({
    action: 'parse',
    page: title,
    prop: 'text|revid',
    format: 'json',
    formatversion: '2',
    redirects: '1',
  });
  const res = await fetch(`${API_URL}?${params}`, {
    headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Wikipedia API ${res.status} for "${title}"`);
  }
  const body = (await res.json()) as {
    error?: { info: string };
    parse?: { text: string; revid: number };
  };
  if (body.error || !body.parse) {
    throw new Error(
      `Wikipedia API error for "${title}": ${body.error?.info ?? 'no content'}`,
    );
  }
  const url = wikiUrl(title);
  return {
    date,
    title,
    url,
    revisionId: body.parse.revid,
    events: parseCurrentEvents(body.parse.text, date, url),
  };
}
