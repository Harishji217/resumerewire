import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

// Tiny file-based analytics: appends one line of JSON per event.
// Writes to the OS temp dir — the only writable location on Vercel's
// read-only serverless filesystem. NB: /tmp is per-instance and
// ephemeral, so counts are approximate on serverless; for exact
// numbers use Vercel Web Analytics (free toggle in the dashboard).
const EVENTS_FILE = path.join(os.tmpdir(), 'resumerewire-events.jsonl');

export async function POST(req) {
  try {
    const { event, page } = await req.json();
    if (typeof event !== 'string' || event.length > 50) {
      return Response.json({ ok: false }, { status: 400 });
    }

    const record = {
      t: new Date().toISOString(),
      event: event.slice(0, 50),
      page: (page || '').slice(0, 100),
      ref: (req.headers.get('referer') || '').slice(0, 200),
    };
    await fs.appendFile(EVENTS_FILE, JSON.stringify(record) + '\n');

    return Response.json({ ok: true });
  } catch (err) {
    // Analytics must NEVER break the app — swallow and report ok
    console.error('Track error (ignored):', err.message);
    return Response.json({ ok: true });
  }
}
