'use client';

import { useEffect, useState } from 'react';
import {
  type Availability,
  type Block,
  type Tier,
  SITES,
  TIERS,
} from '@/lib/studios/pirate';

const BOOK_URL = 'https://book.pirate.com/';

/** Opens Pirate's booking page with the block's date, start time and length. */
function bookingUrl(date: string, site: string, block: Block): string {
  const params = new URLSearchParams({
    date,
    time: String(block.start),
    duration: String(block.end - block.start),
    site,
  });
  return `${BOOK_URL}?${params}`;
}

function hourLabel(h: number): string {
  return `${String(h % 24).padStart(2, '0')}:00`;
}

function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function longEnough(blocks: Block[], minHours: number): Block[] {
  return blocks.filter((b) => b.end - b.start >= minHours);
}

export default function Studios() {
  const [data, setData] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tiers, setTiers] = useState<Tier[]>([...TIERS]);
  const [sites, setSites] = useState<string[]>(SITES.map((s) => s.slug));
  const [minHours, setMinHours] = useState(2);

  async function load(refresh: boolean) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/studios/data${refresh ? '?refresh' : ''}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/studios/data')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: Availability) => !cancelled && setData(json))
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle<T>(list: T[], item: T): T[] {
    return list.includes(item)
      ? list.filter((x) => x !== item)
      : [...list, item];
  }

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
      on
        ? 'border-foreground bg-foreground text-background'
        : 'border-border text-muted hover:border-foreground/30'
    }`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-foreground">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Rehearsal rooms</h1>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-foreground/30 disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        Pirate Studios, next 3 weeks. Weekdays from 17:00, weekends from 09:00,
        until midnight.
        {data &&
          ` Checked ${new Date(data.fetchedAt).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })}.`}
      </p>

      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          {TIERS.map((t) => (
            <button
              key={t}
              onClick={() => setTiers(toggle(tiers, t))}
              className={chip(tiers.includes(t))}
            >
              {t}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">
            At least
            <select
              value={minHours}
              onChange={(e) => setMinHours(Number(e.target.value))}
              className="rounded border border-border bg-background px-1 py-0.5 text-foreground"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}h
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {SITES.map((s) => (
            <button
              key={s.slug}
              onClick={() => setSites(toggle(sites, s.slug))}
              className={chip(sites.includes(s.slug))}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-6 text-sm text-error">Couldn&apos;t load: {error}</p>
      )}
      {!data && loading && (
        <p className="mt-6 text-sm text-muted">
          Checking about 150 searches, this takes a few seconds…
        </p>
      )}

      {data && (
        <div className={`mt-6 space-y-4 ${loading ? 'opacity-50' : ''}`}>
          {data.days.map((day) => {
            const rows = day.sites
              .filter((s) => sites.includes(s.slug))
              .map((s) => ({
                ...s,
                found: tiers
                  .map((t) => ({
                    tier: t,
                    blocks: longEnough(s.tiers[t], minHours),
                  }))
                  .filter((x) => x.blocks.length),
              }))
              .filter((s) => s.found.length);
            return (
              <section
                key={day.date}
                className="rounded-lg border border-border px-4 py-3"
              >
                <h2 className="flex items-baseline justify-between text-sm font-semibold">
                  <span>{dayLabel(day.date)}</span>
                  <span className="text-xs font-normal text-muted">
                    {hourLabel(day.window[0])}–{hourLabel(day.window[1])}
                  </span>
                </h2>
                {rows.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">Nothing free</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {rows.map((s) => (
                      <li key={s.slug} className="flex flex-wrap gap-x-3">
                        <span className="w-24 shrink-0 font-medium">
                          {s.name}
                        </span>
                        {s.found.map(({ tier, blocks }) => (
                          <span key={tier} className="text-muted">
                            <span className="text-foreground">{tier}</span>{' '}
                            {blocks.map((b, i) => (
                              <span key={b.start}>
                                {i > 0 && ', '}
                                <a
                                  href={bookingUrl(day.date, s.slug, b)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline decoration-border underline-offset-2 hover:text-foreground"
                                >
                                  {hourLabel(b.start)}–{hourLabel(b.end)}
                                </a>
                                {b.rooms > 1 && ` (${b.rooms})`}
                              </span>
                            ))}
                          </span>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {data && data.errors.length > 0 && (
        <p className="mt-6 text-xs text-muted">
          {data.errors.length} searches failed:{' '}
          {data.errors.slice(0, 5).join('; ')}
        </p>
      )}

      <p className="mt-8 text-xs text-muted">
        Times are free hours (number of rooms in brackets when more than one).
        Click one to open it on Pirate&apos;s booking page.{' '}
        <a
          href={BOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Book on Pirate &#8599;
        </a>
      </p>
    </main>
  );
}
