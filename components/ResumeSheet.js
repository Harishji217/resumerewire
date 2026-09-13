'use client';

// Renders a resume in one of four templates.
// Shared by the editor preview and any full-page preview.
export default function ResumeSheet({ resume, templateId }) {
  const tpl = templateId || resume.templateId || 'modern';

  return (
    <div className="resume-sheet" data-template={tpl}>
      <Header resume={resume} tpl={tpl} />
      {resume.summary ? (
        <section>
          <SectionTitle tpl={tpl}>Summary</SectionTitle>
          <p>{resume.summary}</p>
        </section>
      ) : null}

      {resume.experience?.length ? (
        <section>
          <SectionTitle tpl={tpl}>Experience</SectionTitle>
          {resume.experience.map((e, i) => (
            <div className="rs-item" key={i}>
              <div className="rs-row">
                <strong>{e.role}{e.company ? ` — ${e.company}` : ''}</strong>
                <span className="rs-date">
                  {[e.start, e.end].filter(Boolean).join(' – ')}
                </span>
              </div>
              {e.location ? <div className="rs-muted">{e.location}</div> : null}
              {e.bullets?.length ? (
                <ul className="rs-bullets">
                  {e.bullets.filter(Boolean).map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {resume.education?.length ? (
        <section>
          <SectionTitle tpl={tpl}>Education</SectionTitle>
          {resume.education.map((ed, i) => (
            <div className="rs-item" key={i}>
              <div className="rs-row">
                <strong>{ed.degree}{ed.school ? ` — ${ed.school}` : ''}</strong>
                <span className="rs-date">
                  {[ed.start, ed.end].filter(Boolean).join(' – ')}
                </span>
              </div>
              {ed.details ? <div>{ed.details}</div> : null}
            </div>
          ))}
        </section>
      ) : null}

      {resume.projects?.length ? (
        <section>
          <SectionTitle tpl={tpl}>Projects</SectionTitle>
          {resume.projects.map((p, i) => (
            <div className="rs-item" key={i}>
              <div className="rs-row">
                <strong>{p.name}</strong>
                {p.link ? (
                  <a href={p.link} className="rs-muted rs-link">
                    {p.link}
                  </a>
                ) : null}
              </div>
              {p.description ? <div>{p.description}</div> : null}
            </div>
          ))}
        </section>
      ) : null}

      {resume.skills?.length ? (
        <section className="skills-block">
          <SectionTitle tpl={tpl}>Skills</SectionTitle>
          <div className="rs-tags">
            {resume.skills.filter(Boolean).map((s, i) => (
              <span className="rs-tag" key={i}>
                {s}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {resume.languages?.length ? (
        <section>
          <SectionTitle tpl={tpl}>Languages</SectionTitle>
          {resume.languages.map((l, i) => (
            <div className="rs-item" key={i}>
              <div className="rs-row">
                <strong>{l.name}</strong>
                <span className="rs-date">{l.proficiency || ''}</span>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function SectionTitle({ tpl, children }) {
  // Template accent styling lives in globals.css via [data-template]
  return <h2>{children}</h2>;
}

function Header({ resume, tpl }) {
  const contacts = [resume.email, resume.phone, resume.location]
    .filter(Boolean)
    .join(' · ');

  if (tpl === 'classic') {
    return (
      <header className="rs-header rs-header-center">
        <h1>{resume.name || 'Your Name'}</h1>
        {resume.title ? <p className="rs-title">{resume.title}</p> : null}
        {contacts ? <p className="rs-muted">{contacts}</p> : null}
        {resume.links?.length ? (
          <p className="rs-muted">
            {resume.links.map((l, i) => (
              <span key={i}>
                {i > 0 ? ' · ' : ''}
                {l.url ? (
                  <a href={l.url}>{l.label || l.url}</a>
                ) : (
                  l.label
                )}
              </span>
            ))}
          </p>
        ) : null}
      </header>
    );
  }

  if (tpl === 'bold') {
    return (
      <header className="rs-header rs-header-band">
        <h1>{resume.name || 'Your Name'}</h1>
        {resume.title ? <p className="rs-title">{resume.title}</p> : null}
        <p className="rs-band-contacts">
          {[contacts, ...(resume.links || []).map((l) => l.label || l.url)]
            .filter(Boolean)
            .join('  ·  ')}
        </p>
      </header>
    );
  }

  if (tpl === 'compact') {
    // Compact uses a sidebar layout rendered via CSS grid
    return (
      <header className="rs-header rs-header-side">
        <div>
          <h1>{resume.name || 'Your Name'}</h1>
          {resume.title ? <p className="rs-title">{resume.title}</p> : null}
        </div>
        <div className="rs-side-contacts">
          {resume.email ? <div>{resume.email}</div> : null}
          {resume.phone ? <div>{resume.phone}</div> : null}
          {resume.location ? <div>{resume.location}</div> : null}
          {(resume.links || []).map((l, i) => (
            <div key={i}>{l.label || l.url}</div>
          ))}
        </div>
      </header>
    );
  }

  // modern (default)
  return (
    <header className="rs-header rs-header-modern">
      <div>
        <h1>{resume.name || 'Your Name'}</h1>
        {resume.title ? <p className="rs-title">{resume.title}</p> : null}
      </div>
      <div className="rs-side-contacts">
        {resume.email ? <div>{resume.email}</div> : null}
        {resume.phone ? <div>{resume.phone}</div> : null}
        {resume.location ? <div>{resume.location}</div> : null}
        {(resume.links || []).map((l, i) => (
          <div key={i}>{l.label || l.url}</div>
        ))}
      </div>
    </header>
  );
}
