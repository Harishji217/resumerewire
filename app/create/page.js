'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TEMPLATES } from '@/lib/resume';
import { track } from '@/lib/track';

export default function CreatePage() {
  const router = useRouter();
  const [mode, setMode] = useState('paste'); // 'paste' | 'upload'
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [templateId, setTemplateId] = useState('modern');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    track('pageview');
  }, []);

  async function handleGenerate() {
    setError('');

    let inputText = text;

    if (mode === 'upload') {
      if (!file) {
        setError('Choose a PDF file first.');
        return;
      }
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/extract-pdf', {
          method: 'POST',
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'PDF extraction failed');
        inputText = data.text;
      } catch (err) {
        setBusy(false);
        setError(err.message);
        return;
      }
    } else if (!text.trim()) {
      setError('Paste your LinkedIn profile or resume text first.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      track('generate', mode === 'upload' ? 'pdf' : 'paste');

      // Stash the generated resume for the editor page
      sessionStorage.setItem('better_resume_pending', JSON.stringify({
        ...data.resume,
        templateId,
      }));
      router.push('/editor?new=1');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="create">
      <header className="site-nav">
        <div className="container nav-inner">
          <a href="/" className="logo">
            <span className="logo-mark">RR</span>
            <span>ResumeRewire</span>
          </a>
          <nav className="nav-links">
            <a href="/dashboard" className="btn btn-ghost">
              Dashboard
            </a>
          </nav>
        </div>
      </header>

      <div className="container">
        <div className="create-head">
          <p className="eyebrow">New resume</p>
          <h1>Tell us about you</h1>
          <p className="create-sub">
            Paste your LinkedIn profile (Ctrl+A on your profile page, copy,
            paste here) or upload an existing resume PDF.
          </p>
        </div>

        <div className="create-grid">
          {/* ---- Input ---- */}
          <div className="card create-input">
            <div className="mode-tabs">
              <button
                className={mode === 'paste' ? 'mode-tab active' : 'mode-tab'}
                onClick={() => setMode('paste')}
              >
                Paste text
              </button>
              <button
                className={mode === 'upload' ? 'mode-tab active' : 'mode-tab'}
                onClick={() => setMode('upload')}
              >
                Upload PDF
              </button>
            </div>

            {mode === 'paste' ? (
              <div className="field">
                <label htmlFor="pastebox">
                  LinkedIn profile / current resume text
                </label>
                <textarea
                  id="pastebox"
                  rows={14}
                  placeholder={
                    'John Doe\nSoftware Engineer at Acme Corp\n\nExperience:\n- Built...\n- Led...\n\nSkills: React, Node.js...'
                  }
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="pdffile">Resume PDF (max 10MB)</label>
                <input
                  id="pdffile"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file ? (
                  <p className="file-note">
                    Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                  </p>
                ) : null}
              </div>
            )}

            {error ? <p className="form-error">{error}</p> : null}

            <button
              className="btn btn-accent btn-block"
              onClick={handleGenerate}
              disabled={busy}
            >
              {busy ? 'Generating…' : 'Generate my resume'}
            </button>
            <p className="privacy-note">
              Nothing is stored on a server — your text is sent only to the AI
              to structure it.
            </p>
          </div>

          {/* ---- Template picker ---- */}
          <div className="card create-templates">
            <h3>Choose a template</h3>
            <div className="tpl-picker">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  className={
                    templateId === t.id
                      ? 'tpl-option active'
                      : 'tpl-option'
                  }
                  onClick={() => setTemplateId(t.id)}
                >
                  <span className="tpl-option-name">{t.name}</span>
                  <span className="tpl-option-desc">{t.desc}</span>
                </button>
              ))}
            </div>
            <p className="tpl-note">
              You can switch templates anytime in the editor.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
