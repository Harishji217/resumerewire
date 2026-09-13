'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ResumeSheet from '@/components/ResumeSheet';
import { TEMPLATES, emptyResume, getResume, saveResume } from '@/lib/resume';
import { track } from '@/lib/track';

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="editor"><div className="container"><p className="dash-empty">Loading…</p></div></div>}>
      <EditorInner />
    </Suspense>
  );
}

function EditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [resume, setResume] = useState(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState('basics'); // basics|experience|education|skills

  useEffect(() => {
    if (searchParams.get('new')) {
      const pending = sessionStorage.getItem('better_resume_pending');
      if (pending) {
        const parsed = JSON.parse(pending);
        sessionStorage.removeItem('better_resume_pending');
        const withId = { ...emptyResume(), ...parsed };
        saveResume(withId);
        setResume(withId);
        return;
      }
    }
    const existing = getResume(searchParams.get('id'));
    if (existing) {
      setResume(existing);
    } else {
      router.replace('/dashboard');
    }
  }, [searchParams, router]);

  // Autosave (debounced)
  useEffect(() => {
    if (!resume) return;
    const t = setTimeout(() => {
      saveResume(resume);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 800);
    return () => clearTimeout(t);
  }, [resume]);

  const update = useCallback((patch) => {
    setResume((r) => ({ ...r, ...patch }));
  }, []);

  function handleExport() {
    track('download');
    window.print();
  }

  if (!resume) {
    return (
      <main className="editor">
        <div className="container">
          <p className="dash-empty">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="editor">
      <header className="site-nav no-print">
        <div className="container nav-inner">
          <a href="/dashboard" className="logo">
            <span className="logo-mark">RR</span>
            <span>ResumeRewire</span>
          </a>
          <div className="editor-actions">
            {saved ? <span className="save-flag">Saved ✓</span> : null}
            <button className="btn btn-primary" onClick={handleExport}>
              Download PDF
            </button>
          </div>
        </div>
      </header>

      <div className="editor-body">
        {/* ---- Left: form ---- */}
        <div className="editor-form no-print">
          <div className="tpl-switch">
            <label>Template</label>
            <div className="tpl-switch-row">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  className={
                    resume.templateId === t.id
                      ? 'tpl-option active'
                      : 'tpl-option'
                  }
                  onClick={() => update({ templateId: t.id })}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="form-tabs">
            {['basics', 'experience', 'education', 'skills'].map((t) => (
              <button
                key={t}
                className={tab === t ? 'form-tab active' : 'form-tab'}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'basics' ? (
            <div>
              <div className="field">
                <label>Full name</label>
                <input
                  value={resume.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Professional title</label>
                <input
                  value={resume.title}
                  onChange={(e) => update({ title: e.target.value })}
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Email</label>
                  <input
                    value={resume.email}
                    onChange={(e) => update({ email: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input
                    value={resume.phone}
                    onChange={(e) => update({ phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label>Location</label>
                <input
                  value={resume.location}
                  onChange={(e) => update({ location: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Summary</label>
                <textarea
                  rows={5}
                  value={resume.summary}
                  onChange={(e) => update({ summary: e.target.value })}
                />
              </div>
            </div>
          ) : null}

          {tab === 'experience' ? (
            <RepeatableSection
              items={resume.experience}
              fieldKeys={['role', 'company', 'start', 'end', 'location']}
              bulletsKey="bullets"
              labels={['Role', 'Company', 'Start', 'End', 'Location']}
              onChange={(experience) => update({ experience })}
              blankItem={{
                role: '',
                company: '',
                start: '',
                end: '',
                location: '',
                bullets: [''],
              }}
            />
          ) : null}

          {tab === 'education' ? (
            <RepeatableSection
              items={resume.education}
              fieldKeys={['degree', 'school', 'start', 'end', 'details']}
              labels={['Degree', 'School', 'Start', 'End', 'Details']}
              onChange={(education) => update({ education })}
              blankItem={{
                degree: '',
                school: '',
                start: '',
                end: '',
                details: '',
              }}
            />
          ) : null}

          {tab === 'skills' ? (
            <div>
              <div className="field">
                <label>Skills (comma-separated)</label>
                <textarea
                  rows={6}
                  value={(resume.skills || []).join(', ')}
                  onChange={(e) =>
                    update({
                      skills: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="field">
                <label>Languages (one per line: Name | Proficiency)</label>
                <textarea
                  rows={3}
                  value={(resume.languages || [])
                    .map((l) => [l.name, l.proficiency].filter(Boolean).join(' | '))
                    .join('\n')}
                  onChange={(e) =>
                    update({
                      languages: e.target.value
                        .split('\n')
                        .filter((l) => l.trim())
                        .map((line) => {
                          const [name, proficiency] = line.split('|');
                          return {
                            name: (name || '').trim(),
                            proficiency: (proficiency || '').trim(),
                          };
                        }),
                    })
                  }
                />
              </div>
              <div className="field">
                <label>Projects (one per line: Name | Description | Link)</label>
                <textarea
                  rows={5}
                  value={(resume.projects || [])
                    .map(
                      (p) =>
                        [p.name, p.description, p.link]
                          .filter(Boolean)
                          .join(' | ')
                    )
                    .join('\n')}
                  onChange={(e) =>
                    update({
                      projects: e.target.value
                        .split('\n')
                        .filter((l) => l.trim())
                        .map((line) => {
                          const [name, description, link] = line.split('|');
                          return {
                            name: (name || '').trim(),
                            description: (description || '').trim(),
                            link: (link || '').trim(),
                          };
                        }),
                    })
                  }
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* ---- Right: preview ---- */}
        <div className="editor-preview">
          <ResumeSheet resume={resume} templateId={resume.templateId} />
        </div>
      </div>
    </main>
  );
}

/* ------- Repeatable experience/education editor ------- */
function RepeatableSection({
  items,
  fieldKeys,
  labels,
  bulletsKey,
  onChange,
  blankItem,
}) {
  function setItem(i, patch) {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    onChange(next);
  }

  function removeItem(i) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  function addItem() {
    onChange([...(items || []), blankItem]);
  }

  return (
    <div>
      {(items || []).map((item, i) => (
        <div className="rep-item" key={i}>
          <div className="rep-head">
            <span>#{i + 1}</span>
            <button className="rep-del" onClick={() => removeItem(i)}>
              Remove
            </button>
          </div>
          {fieldKeys.map((key, k) => (
            <div className="field" key={key}>
              <label>{labels[k]}</label>
              {key === 'details' ? (
                <textarea
                  rows={2}
                  value={item[key] || ''}
                  onChange={(e) => setItem(i, { [key]: e.target.value })}
                />
              ) : (
                <input
                  value={item[key] || ''}
                  onChange={(e) => setItem(i, { [key]: e.target.value })}
                />
              )}
            </div>
          ))}
          {bulletsKey ? (
            <div className="field">
              <label>Bullet points (one per line)</label>
              <textarea
                rows={4}
                value={(item[bulletsKey] || []).join('\n')}
                onChange={(e) =>
                  setItem(i, {
                    [bulletsKey]: e.target.value.split('\n'),
                  })
                }
              />
            </div>
          ) : null}
        </div>
      ))}
      <button className="btn btn-ghost btn-block" onClick={addItem}>
        + Add
      </button>
    </div>
  );
}
