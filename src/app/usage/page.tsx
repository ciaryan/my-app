import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import {
  getHistory,
  playsConfigured,
  TRACKED_PAGES,
  type TrackedPage,
} from '@/lib/plays';
import { londonDate } from '@/lib/quiz/dates';

export const metadata: Metadata = {
  title: 'Usage — Ciarán Ryan',
  robots: { index: false, follow: false },
};

const DAYS = 60;
const PAGES = Object.keys(TRACKED_PAGES) as TrackedPage[];

function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export default async function UsagePage() {
  await connection();

  let history: Awaited<ReturnType<typeof getHistory>> | null = null;
  let error: string | null = null;
  if (!playsConfigured()) {
    error = 'The visit counter is not configured (no Upstash env vars).';
  } else {
    try {
      history = await getHistory(londonDate(), DAYS);
    } catch (err) {
      console.error('[usage]', err);
      error = 'Could not load visit counts from Upstash.';
    }
  }

  const sum = (rows: NonNullable<typeof history>, page: TrackedPage) =>
    rows.reduce((n, r) => n + r.counts[page], 0);
  // Hide the run of empty days before tracking started.
  const lastActive = history
    ? history.findLastIndex((r) => PAGES.some((p) => r.counts[p] > 0))
    : -1;
  const rows = history?.slice(0, Math.max(lastActive + 1, 1)) ?? [];
  const max = Math.max(
    1,
    ...rows.flatMap((r) => PAGES.map((p) => r.counts[p])),
  );

  return (
    <div className="flex flex-1 justify-center px-4 py-10 md:py-16">
      <main className="w-full max-w-3xl space-y-8 text-foreground">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            &larr; Home
          </Link>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Usage</h1>
          <p className="text-sm text-muted">
            Distinct visitors per page per day (UK time), last {DAYS} days. Each
            browser counts once per page per day.
          </p>
        </div>

        {error ? (
          <p className="text-sm text-muted">{error}</p>
        ) : (
          history && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {PAGES.map((p) => (
                  <div
                    key={p}
                    className="rounded-lg border border-border px-3 py-2"
                  >
                    <div className="text-xs text-muted">{TRACKED_PAGES[p]}</div>
                    <div className="font-mono text-lg">
                      {history[0].counts[p].toLocaleString()}
                    </div>
                    <div className="text-xs text-muted">
                      today &middot; {sum(history.slice(0, 7), p)} 7d &middot;{' '}
                      {sum(history, p)} {DAYS}d
                    </div>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="py-2 pr-3 font-normal">Day</th>
                      {PAGES.map((p) => (
                        <th
                          key={p}
                          className="px-2 py-2 text-right font-normal"
                        >
                          {TRACKED_PAGES[p]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.date} className="border-b border-border/50">
                        <td className="py-1.5 pr-3 whitespace-nowrap text-muted">
                          {dayLabel(r.date)}
                        </td>
                        {PAGES.map((p) => {
                          const n = r.counts[p];
                          return (
                            <td
                              key={p}
                              className="px-2 py-1.5 text-right font-mono tabular-nums"
                              style={{
                                backgroundColor: n
                                  ? `color-mix(in srgb, var(--accent) ${Math.round(8 + (n / max) * 30)}%, transparent)`
                                  : undefined,
                              }}
                            >
                              {n ? (
                                n.toLocaleString()
                              ) : (
                                <span className="text-muted">&ndash;</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}
      </main>
    </div>
  );
}
