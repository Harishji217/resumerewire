import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { NextResponse } from 'next/server';

// Must match the path used by /api/track (OS temp dir — writable on Vercel)
const EVENTS_FILE = path.join(os.tmpdir(), 'resumerewire-events.jsonl');

// GET /api/stats?token=ADMIN_TOKEN
// Returns aggregated usage stats. The token is set via ADMIN_TOKEN in
// .env.local — keep it secret, this is your admin dashboard's key.
export async function GET(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let raw = '';
    try {
      raw = await fs.readFile(EVENTS_FILE, 'utf8');
    } catch {
      // No events yet
    }

    const events = raw
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // Unique-ish visitor id via ref+date bucketing would need cookies;
    // for MVP we report event counts and daily breakdowns.
    const byEvent = {};
    const byDay = {};
    for (const e of events) {
      byEvent[e.event] = (byEvent[e.event] || 0) + 1;
      const day = e.t.slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    }

    return NextResponse.json({
      total: events.length,
      byEvent,
      byDay,
    });
  } catch (err) {
    console.error('Stats error:', err);
    return NextResponse.json({ error: 'Stats failed' }, { status: 500 });
  }
}
