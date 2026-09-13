'use client';

import { useEffect, useState } from 'react';

// Owner-only usage dashboard. Visit /admin and enter your ADMIN_TOKEN
// (from .env.local) to see usage stats.
export default function AdminPage() {
  const [token, setToken] = useState('');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('rr_admin_token');
    if (saved) {
      setToken(saved);
      load(saved);
    }
  }, []);

  async function load(t) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/stats?token=${encodeURIComponent(t)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setStats(data);
      sessionStorage.setItem('rr_admin_token', t);
    } catch (err) {
      setError('Wrong token or server error');
      setStats(null);
    } finally {
      setBusy(false);
    }
  }

  const days = stats
    ? Object.entries(stats.byDay).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 14)
    : [];

  return (
    <main className="admin">
      <div className="container">
        <div className="create-head">
          <p className="eyebrow">Owner dashboard</p>
          <h1>Usage stats</h1>
        </div>

        {!stats ? (
          <div className="card create-input" style={{ maxWidth: 420 }}>
            <div className="field">
              <label>Admin token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="From ADMIN_TOKEN in .env.local"
              />
            </div>
            {error ? <p className="form-error">{error}</p> : null}
            <button
              className="btn btn-primary btn-block"
              onClick={() => load(token)}
              disabled={busy || !token}
            >
              {busy ? 'Loading…' : 'View stats'}
            </button>
          </div>
        ) : (
          <div>
            <div className="stat-grid">
              <div className="card stat">
                <div className="stat-num">{stats.total}</div>
                <div className="stat-label">Total events</div>
              </div>
              <div className="card stat">
                <div className="stat-num">{stats.byEvent.pageview || 0}</div>
                <div className="stat-label">Page views</div>
              </div>
              <div className="card stat">
                <div className="stat-num">{stats.byEvent.generate || 0}</div>
                <div className="stat-label">Resumes generated</div>
              </div>
              <div className="card stat">
                <div className="stat-num">{stats.byEvent.download || 0}</div>
                <div className="stat-label">PDF downloads</div>
              </div>
            </div>

            <h3 className="admin-sub">Last 14 days</h3>
            <div className="card admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Events</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map(([day, n]) => (
                    <tr key={day}>
                      <td>{day}</td>
                      <td>{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
