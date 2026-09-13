import { promises as fs } from 'fs';
import path from 'path';

// Tiny file-based analytics: appends one line of JSON per event.
// Stored at .analytics/events.jsonl (gitignored). For a hobby project
// this is plenty; swap for a real DB if traffic ever gets serious.
const EVENTS_FILE = path.join(process.cwd(), '.analytics', 'events.jsonl');

export async function POST(req) {
  try {
    const { event, page } = await req.json();
    if (typeof event !== 'string' || event.length > 50) {
      return Response.json({ ok: false }, { status: 400 });
    }

    const dir = path.dirname(EVENTS_FILE);
    await fs.mkdir(dir, { recursive: true });

    const record = {
      t: new Date().toISOString(),
      event: event.slice(0, 50),
      page: (page || '').slice(0, 100),
      ref: (req.headers.get('referer') || '').slice(0, 200),
    };
    await fs.appendFile(EVENTS_FILE, JSON.stringify(record) + '\n');

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Track error:', err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
