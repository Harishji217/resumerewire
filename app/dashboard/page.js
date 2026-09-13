'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadResumes, deleteResume } from '@/lib/resume';
import { track } from '@/lib/track';

export default function DashboardPage() {
  const [resumes, setResumes] = useState(null); // null = loading

  useEffect(() => {
    setResumes(loadResumes());
    track('pageview');
  }, []);

  function handleDelete(id) {
    if (confirm('Delete this resume?')) {
      deleteResume(id);
      setResumes(loadResumes());
    }
  }

  return (
    <main className="dash">
      <header className="site-nav">
        <div className="container nav-inner">
          <Link href="/" className="logo">
            <span className="logo-mark">RR</span>
            <span>ResumeRewire</span>
          </Link>
          <nav className="nav-links">
            <Link href="/dashboard" className="btn btn-ghost">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <div className="container">
        <div className="dash-head">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>Your resumes</h1>
          </div>
          <Link href="/create" className="btn btn-accent">
            + Create new
          </Link>
        </div>

        {resumes === null ? (
          <p className="dash-empty">Loading…</p>
        ) : resumes.length === 0 ? (
          <div className="dash-empty card">
            <h2>No resumes yet</h2>
            <p>
              Paste your LinkedIn profile or upload a PDF to generate your
              first resume.
            </p>
            <Link href="/create" className="btn btn-primary">
              Create your first resume
            </Link>
          </div>
        ) : (
          <div className="dash-grid">
            {resumes.map((r) => (
              <div className="dash-card card" key={r.id}>
                <div className="dash-card-top">
                  <span className="dash-tpl">{r.templateId}</span>
                  <span className="dash-date">
                    {new Date(r.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <h3>{r.name || 'Untitled'}</h3>
                <p className="dash-card-sub">{r.title || 'No title'}</p>
                <div className="dash-card-actions">
                  <Link href={`/editor?id=${r.id}`} className="btn btn-ghost">
                    Edit
                  </Link>
                  <button
                    className="btn btn-ghost dash-del"
                    onClick={() => handleDelete(r.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
