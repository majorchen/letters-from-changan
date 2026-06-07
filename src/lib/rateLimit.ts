import { NextRequest } from 'next/server';

const hits = new Map<string, number[]>();
const MAX_WINDOW_MS = 60_000;
const MAX_REQUESTS = Number(process.env.API_RATE_LIMIT_PER_MINUTE || 100);

function cleanup() {
  const now = Date.now();
  for (const [key, timestamps] of hits) {
    const valid = timestamps.filter(t => now - t < MAX_WINDOW_MS);
    if (valid.length === 0) hits.delete(key);
    else hits.set(key, valid);
  }
}

setInterval(cleanup, 120_000);

export function checkRateLimit(req: NextRequest): Response | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
  const now = Date.now();
  const timestamps = (hits.get(ip) || []).filter(t => now - t < MAX_WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS) {
    return Response.json(
      { error: '请求过于频繁，请稍后再试' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }
  timestamps.push(now);
  hits.set(ip, timestamps);
  return null;
}
