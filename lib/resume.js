// Shared resume schema, demo fallback, and localStorage helpers.

export const TEMPLATES = [
  { id: 'classic', name: 'Classic', desc: 'Clean black & white, centered header' },
  { id: 'modern', name: 'Modern', desc: 'Orange accent section labels' },
  { id: 'compact', name: 'Compact', desc: 'Two-column with sidebar' },
  { id: 'bold', name: 'Bold', desc: 'Dark header band, high contrast' },
];

export function emptyResume() {
  return {
    id: 'r_' + Math.random().toString(36).slice(2, 10),
    name: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    links: [],
    summary: '',
    skills: [],
    languages: [],
    experience: [],
    education: [],
    projects: [],
    templateId: 'modern',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Fallback resume used when the AI is unavailable (no key, rate limits).
// LinkedIn PDFs/text follow a consistent block structure:
//   Role
//   Company
//   Date-range (e.g. "Feb 2021 – Present")
//   Description sentences...
// This parser exploits that. It's still not as good as the AI — that's
// why the UI tells the user to retry when this runs.
export function demoResumeFromText(text) {
  const r = emptyResume();

  // -- Clean the raw text: drop sidebar/boilerplate junk --
  const junkRe =
    /^(page \d+ of \d+|contact.*|about|summary|experience|education|skills|projects|languages|certifications|honors?\s*-?\s*awards|top skills|interests|linkedin|©.*|\\?u?00a9.*)$/i;
  const urlRe = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|in|io|dev|org|net|ai|me)\b/i;
  const locRe = /^[A-Z][a-zA-Z .]+,\s*[A-Z][a-zA-Z .]+(,\s*[A-Z][a-zA-Z .]+)?$/;
  const rawLines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  let lines = rawLines
    // Strip trailing "· 2 yrs 7 mos" durations — they break date matching
    .map((l) =>
      l.replace(/\s*·\s*\d+\s*(yrs?|years?|mos?|months?)(\s+\d+\s*(yrs?|years?|mos?|months?))?\s*$/i, '').trim()
    )
    .filter((l) => l && !junkRe.test(l));

  // -- Contact info (email, links — never fake placeholders) --
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  const linkMatches = [
    ...text.matchAll(
      /(www\.)?(linkedin\.com\/in\/[\w\-%]+|github\.com\/[\w-]+|[\w-]+\.(github\.io|vercel\.app|com|in|dev)\/?[\w\-./]*)/gi
    ),
  ].map((m) => m[0]);
  const phoneMatch = text.match(/(\+\d{1,3}[\s-]?)?\d{5}[\s-]?\d{5}/);

  r.email = emailMatch ? emailMatch[0] : '';
  r.phone = phoneMatch && !/19|20\d\d/.test(phoneMatch[1] || '') ? phoneMatch[0] : '';
  r.links = [...new Set(linkMatches)]
    .slice(0, 3)
    .map((u) => ({
      label: /linkedin/i.test(u) ? 'LinkedIn' : /^github\.com/i.test(u) ? 'GitHub' : 'Website',
      url: u.startsWith('http') || u.startsWith('www') ? u : `https://${u}`,
    }));

  // -- Name & title: first lines that look like actual identity --
  // (skip URLs, "(LinkedIn)" handles, parenthesized skill lines like
  // "Python (Programming Language)", locations, dates, long lines)
  const nameTitleLines = lines.filter(
    (l) =>
      !urlRe.test(l) &&
      !/\(linkedin\)/i.test(l) &&
      !locRe.test(l) &&
      !/\(/.test(l) &&
      l.length > 1 &&
      l.length < 70 &&
      !/^\d/.test(l) &&
      (l.match(/\S+/g) || []).length <= 6
  );

  // Best name source when present: the LinkedIn profile slug itself —
  // linkedin.com/in/harish-pal-611982414 → "Harish Pal". Present in both
  // pasted profiles and PDF exports, and never a skill or section label.
  const slug = text.match(/linkedin\.com\/in\/([a-z0-9%_.-]+)/i);
  const slugName = slug
    ? decodeURIComponent(slug[1])
        .replace(/[-_]?\d+$/, '')
        .split(/[-_]/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : '';

  if (slugName && slugName.length >= 3) {
    r.name = slugName;
    r.title =
      nameTitleLines.find(
        (l) => l.toLowerCase().replace(/[^a-z]/g, '') !== slugName.toLowerCase().replace(/[^a-z]/g, '')
      ) || '';
  } else {
    r.name = nameTitleLines[0] || 'Your Name';
    r.title = nameTitleLines[1] || '';
  }

  // -- Location: a line that looks like City, State, Country --
  r.location =
    lines.find((l) =>
      /^[A-Z][a-zA-Z .]+,\s*[A-Z][a-zA-Z .]+(,\s*[A-Z][a-zA-Z .]+)?$/.test(l) && l.length < 60
    ) || '';

  // -- Languages with proficiency --
  const langMap = [
    ['hindi', /hindi[^.]{0,40}?(native|bilingual)/i, 'Native or Bilingual'],
    ['english', /english[^.]{0,40}?(professional|working)/i, 'Professional Working'],
    ['english', /english/i, 'Professional'],
    ['hindi', /hindi/i, 'Native'],
  ];
  const seenLangs = new Set();
  r.languages = [];
  for (const [name, re, prof] of langMap) {
    if (re.test(text) && !seenLangs.has(name)) {
      seenLangs.add(name);
      r.languages.push({ name: name[0].toUpperCase() + name.slice(1), proficiency: prof });
    }
  }

  // -- Skills: text between "Top Skills"/"Skills" and the next section --
  const skillsStart = lines.findIndex((l) => /^(top )?skills$/i.test(l));
  if (skillsStart >= 0) {
    const sectionEnd = /^(languages|certifications|experience|education|projects)$/i;
    const skillLines = [];
    for (let i = skillsStart + 1; i < lines.length && skillLines.length < 8; i++) {
      if (sectionEnd.test(lines[i])) break;
      skillLines.push(lines[i]);
    }
    const skillText = skillLines.join(' ');
    r.skills = skillText
      .split(/\s{2,}|,|\n/)
      .map((s) => s.replace(/\s*\(.*?\)\s*/g, ' ').trim())
      .filter((s) => s.length > 2 && s.length < 40)
      .slice(0, 12);
  }

  // -- Experience: Role → Company → Date-range → description blocks --
  const dateRe =
    /^((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\.?\s*\d{4}|\d{4})\s*[–—-]\s*((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\.?\s*\d{4}|\d{4}|present)\.?$/i;

  // A line that can serve as role/company: not a URL, handle, location, or junk
  const isRoleJunk = (l) =>
    !l || urlRe.test(l) || /\(linkedin\)/i.test(l) || locRe.test(l) || junkRe.test(l) || /^\d/.test(l);

  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (dateRe.test(lines[i])) {
      const date = lines[i];
      // Walk backwards past junk to find company (line just above date)
      // and role (line above the company)
      let companyLine = '';
      for (let k = i - 1; k >= 0 && k >= i - 3; k--) {
        if (isRoleJunk(lines[k])) continue;
        companyLine = lines[k];
        break;
      }
      let roleLine = '';
      for (let k = i - 1; k >= 0 && k >= i - 4; k--) {
        if (lines[k] === companyLine) continue;
        if (isRoleJunk(lines[k])) continue;
        roleLine = lines[k];
        break;
      }
      if (!roleLine && companyLine) {
        // Only one usable line — treat it as the role
        roleLine = companyLine;
        companyLine = '';
      }
      // Description: lines until the next block or junk heading
      let j = i + 1;
      const descLines = [];
      while (
        j < lines.length &&
        !dateRe.test(lines[j]) &&
        !/^(experience|education|skills|projects|languages)$/i.test(lines[j])
      ) {
        descLines.push(lines[j]);
        j++;
      }
      blocks.push({ roleLine: roleLine || 'Professional', companyLine, date, descLines, endIdx: j });
      i = j - 1;
    }
  }

  r.experience = blocks.map((b) => {
    // LinkedIn sometimes renders "Role — Role" when company is missing;
    // detect and split
    let role = b.roleLine;
    let company = b.companyLine;
    const dup = role.split(/\s[–—-]\s/);
    if (dup.length === 2 && dup[0].trim() === dup[1].trim()) {
      role = dup[0].trim();
      company = '';
    }
    // If company line is itself a date or junk, drop it
    if (company && (dateRe.test(company) || junkRe.test(company))) company = '';

    const [start, end] = b.date.split(/\s*[–—-]\s*/);
    const bullets = b.descLines
      .filter((l) => !urlRe.test(l) && !/\(linkedin\)/i.test(l) && !locRe.test(l))
      .join(' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15 && !/^page \d+/i.test(s))
      .slice(0, 4);

    return {
      company: company || 'Self-employed',
      role: role || 'Professional',
      start: start?.trim() || '',
      end: end?.trim() || '',
      location: '',
      bullets: bullets.length
        ? bullets
        : ['Describe your key responsibilities and achievements in this role.'],
    };
  });

  if (!r.experience.length) {
    r.experience = [
      {
        company: 'Add your company',
        role: r.title || 'Your Role',
        start: '',
        end: '',
        location: '',
        bullets: ['Describe your key responsibilities and achievements in this role.'],
      },
    ];
  }

  // -- Summary: a substantive About/Summary paragraph (full sentences,
  // capitalized, not a URL/handle fragment) --
  const candidates = [];
  const aboutRe = /(?:summary|about)\s+([^]{40,600})/gi;
  let am;
  while ((am = aboutRe.exec(text))) {
    // Take sentences until we hit a section heading or contact junk
    const sentences = am[1]
      .split(/(?<=[.!?])\s+|\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const para = [];
    for (const s of sentences) {
      if (/^(experience|education|skills|projects|languages|contact|linkedin|interests|certifications)$/i.test(s)) break;
      if (urlRe.test(s) || /\(linkedin\)/i.test(s) || locRe.test(s)) continue;
      // Full sentence: starts capital, ends with punctuation, decent length
      if (/^[A-Z][^.]{20,250}[.!?]$/.test(s)) para.push(s);
    }
    if (para.length) candidates.push(para.slice(0, 3).join(' '));
  }
  r.summary = candidates[0] ||
    `${r.title || 'Professional'} with experience across ${r.experience.length} role${r.experience.length > 1 ? 's' : ''}. ${r.skills.slice(0, 4).join(', ')}. Focused on delivering measurable results.`;

  // -- Education: school lines with year ranges near "Education" --
  const eduStart = lines.findIndex((l) => /^education$/i.test(l));
  if (eduStart >= 0) {
    const eduText = lines.slice(eduStart + 1, eduStart + 10).join(' ');
    const eduMatch = eduText.match(/([A-Z][A-Za-z&.,' -]{5,80}(?:University|Institute|College|School)[A-Za-z.,' -]*)/);
    if (eduMatch) {
      const eduDate = eduText.match(/(\d{4})\s*[–—-]\s*(\d{4})/);
      r.education = [
        {
          school: eduMatch[1].trim().slice(0, 80),
          degree: 'Degree not specified in source',
          start: eduDate?.[1] || '',
          end: eduDate?.[2] || '',
          details: '',
        },
      ];
    }
  }

  return r;
}

const LS_KEY = 'better_resume_data';

export function loadResumes() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveResume(resume) {
  const all = loadResumes().filter((r) => r.id !== resume.id);
  resume.updatedAt = Date.now();
  all.unshift(resume);
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

export function deleteResume(id) {
  localStorage.setItem(
    LS_KEY,
    JSON.stringify(loadResumes().filter((r) => r.id !== id))
  );
}

export function getResume(id) {
  return loadResumes().find((r) => r.id === id) || null;
}
