'use client';

// Fire-and-forget analytics beacon. No cookies, no PII — just
// { event, page } sent to /api/track.
export function track(event, page) {
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, page: page || window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never let analytics break the app
  }
}
