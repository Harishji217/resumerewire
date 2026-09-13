'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { track } from '@/lib/track';

export default function Home() {
  useEffect(() => {
    track('pageview');
  }, []);

  return (
    <main>
      {/* ---------- Nav ---------- */}
      <header className="site-nav">
        <div className="container nav-inner">
          <div className="logo">
            <span className="logo-mark">RR</span>
            <span>ResumeRewire</span>
          </div>
          <nav className="nav-links">
            <a href="#how">How it works</a>
            <a href="#templates">Templates</a>
            <a href="#faq">FAQ</a>
            <Link href="/dashboard" className="btn btn-ghost">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">Rejected to hired</p>
            <h1>
              I applied to 100 jobs and heard nothing back.
              <br />
              Then I fixed one thing — my resume.
            </h1>
            <p className="hero-sub">
              ResumeRewire takes your LinkedIn profile or old resume and turns
              it into an ATS-friendly, recruiter-ready resume in 2 minutes.
              Completely free — no sign-up, no payment, no limits.
            </p>
            <div className="hero-cta">
              <Link href="/dashboard" className="btn btn-accent">
                Build my resume — free
              </Link>
              <span className="hero-note">
                No sign-up needed · 4 templates · Free PDF export
              </span>
            </div>
          </div>

          <div className="hero-visual card">
            <div className="mock-sheet">
              <div className="mock-bar" />
              <div className="mock-line w-60" />
              <div className="mock-line w-40" />
              <div className="mock-gap" />
              <div className="mock-line w-100 faint" />
              <div className="mock-line w-100 faint" />
              <div className="mock-line w-80 faint" />
              <div className="mock-gap" />
              <div className="mock-line w-50" />
              <div className="mock-line w-100 faint" />
              <div className="mock-line w-90 faint" />
              <div className="mock-gap" />
              <div className="mock-tags">
                <span>ATS-friendly</span>
                <span>Recruiter-tested</span>
                <span>2 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="section">
        <div className="container">
          <p className="eyebrow">How it works</p>
          <h2>From raw text to a hired resume in three steps</h2>
          <div className="steps">
            <div className="step card">
              <span className="step-num">01</span>
              <h3>Paste or upload</h3>
              <p>
                Paste your LinkedIn profile text, or upload your existing
                resume PDF. No forms, no typing from scratch.
              </p>
            </div>
            <div className="step card">
              <span className="step-num">02</span>
              <h3>AI structures it</h3>
              <p>
                The AI extracts your experience, skills and education, then
                writes recruiter-ready bullet points for every role.
              </p>
            </div>
            <div className="step card">
              <span className="step-num">03</span>
              <h3>Review &amp; download</h3>
              <p>
                Pick one of four templates, tweak anything in the live editor,
                then export a clean PDF. All completely free.
              </p>
            </div>
            <div className="step card">
              <span className="step-num">04</span>
              <h3>Export &amp; apply</h3>
              <p>
                Your resume is formatted to pass ATS scanners and look sharp
                to human recruiters. Apply with confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Templates ---------- */}
      <section id="templates" className="section section-alt">
        <div className="container">
          <p className="eyebrow">Templates</p>
          <h2>Four templates. One click to switch.</h2>
          <div className="tpl-grid">
            <div className="tpl card">
              <div className="tpl-preview tpl-classic" />
              <div className="tpl-name">Classic</div>
              <p>Clean black &amp; white, centered header</p>
            </div>
            <div className="tpl card">
              <div className="tpl-preview tpl-modern" />
              <div className="tpl-name">Modern</div>
              <p>Orange accent section labels</p>
            </div>
            <div className="tpl card">
              <div className="tpl-preview tpl-compact" />
              <div className="tpl-name">Compact</div>
              <p>Two-column with skills sidebar</p>
            </div>
            <div className="tpl card">
              <div className="tpl-preview tpl-bold" />
              <div className="tpl-name">Bold</div>
              <p>Dark header band, high contrast</p>
            </div>
          </div>
          <div className="tpl-cta">
            <Link href="/dashboard" className="btn btn-primary">
              Try them now — free
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- USP story ---------- */}
      <section className="section">
        <div className="container story">
          <p className="eyebrow">Why trust me</p>
          <h2>I&apos;m not a resume company. I&apos;m the guy who got rejected.</h2>
          <p>
            I applied to job after job and heard nothing. Then I rebuilt my
            resume around what recruiters and ATS scanners actually look for
            — and the interviews started. ResumeRewire packages everything I
            learned into a tool that does it for you in minutes, not weekends.
          </p>
          <p className="story-note">
            — The founder. One-person business, no VC, no team of consultants.
          </p>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="section section-alt">
        <div className="creating">
          <div className="container">
            <p className="eyebrow">FAQ</p>
            <h2>Questions, answered</h2>
            <div className="faq-list">
              <details className="card faq">
                <summary>Is it really free?</summary>
                <p>
                  Yes — completely. Generate, edit, and download as many
                  resumes as you want. No payment, no account, no limits.
                  Your resumes are stored only in your own browser.
                </p>
              </details>
              <details className="card faq">
                <summary>What is an ATS-friendly resume?</summary>
                <p>
                  ATS (Applicant Tracking System) is software that scans your
                  resume before a human ever sees it. Our templates use clean
                  structure, standard section titles, and machine-readable
                  formatting so nothing gets lost in the scan.
                </p>
              </details>
              <details className="card faq">
                <summary>Do you store my resume?</summary>
                <p>
                  In this MVP your resumes are saved only in your browser
                  (localStorage). Nothing is uploaded to a server. A future
                  version will add optional accounts.
                </p>
              </details>
              <details className="card faq">
                <summary>Can I switch templates after generating?</summary>
                <p>
                  Yes — switch between all four templates anytime in the
                  editor. Your content stays the same.
                </p>
              </details>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="logo">
            <span className="logo-mark">RR</span>
            <span>ResumeRewire</span>
          </div>
          <nav className="footer-links">
            <a href="#how">How it works</a>
             <a href="#templates">Templates</a>
            <a href="#faq">FAQ</a>
          </nav>
          <p className="footer-note">
            © {new Date().getFullYear()} ResumeRewire. Built by one person
            with AI.
          </p>
        </div>
      </footer>
    </main>
  );
}
