'use client';

import { useEffect, useState } from 'react';
import type { TrackedPage } from '@/lib/plays';

/**
 * Records a visit to the page. With `show`, also renders "N people have
 * played today" once the count loads (nothing if the counter is down).
 */
export default function PlayCount({
  page,
  show = true,
}: {
  page: TrackedPage;
  show?: boolean;
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/plays', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { count?: unknown } | null) => {
        if (!cancelled && typeof data?.count === 'number' && data.count > 0) {
          setCount(data.count);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [page]);

  if (!show || count === null) return null;
  return (
    <p className="text-xs text-muted">
      {count === 1 ? '1 person has' : `${count.toLocaleString()} people have`}{' '}
      played today
    </p>
  );
}
