import { type Availability, fetchAvailability } from '@/lib/studios/pirate';

export const maxDuration = 60;

// Per-instance cache so page loads and repeated refreshes don't each make
// ~200 requests to Pirate's API.
const CACHE_MS = 15 * 60_000;
const MIN_REFRESH_MS = 60_000;
let cached: { at: number; data: Availability } | null = null;
let inflight: Promise<Availability> | null = null;

export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.has('refresh');
  const age = cached ? Date.now() - cached.at : Infinity;

  if (cached && age < (refresh ? MIN_REFRESH_MS : CACHE_MS)) {
    return Response.json(cached.data);
  }

  inflight ??= fetchAvailability().finally(() => {
    inflight = null;
  });
  const data = await inflight;
  // Don't keep a mostly failed run around for 15 minutes.
  if (data.errors.length < 10) {
    cached = { at: Date.now(), data };
  }
  return Response.json(data);
}
