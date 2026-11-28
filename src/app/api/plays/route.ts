import { londonDate } from '@/lib/quiz/dates';
import { isTrackedPage, playsConfigured, recordPlay } from '@/lib/plays';

/**
 * POST { page } records that this visitor opened the page today and returns
 * { count }: distinct visitors today (Europe/London date). 503 when the
 * counter isn't configured, so the page just hides the line.
 */
export async function POST(request: Request) {
  if (!playsConfigured()) {
    return Response.json({ error: 'not configured' }, { status: 503 });
  }
  const body: unknown = await request.json().catch(() => null);
  const page = (body as { page?: unknown } | null)?.page;
  if (!isTrackedPage(page)) {
    return Response.json({ error: 'unknown page' }, { status: 400 });
  }
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const userAgent = request.headers.get('user-agent') ?? '';
  try {
    const count = await recordPlay(page, londonDate(), ip, userAgent);
    return Response.json({ count });
  } catch (err) {
    console.error('[plays]', err);
    return Response.json({ error: 'counter unavailable' }, { status: 503 });
  }
}
