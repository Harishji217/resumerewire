// Shared resume schema, LinkedIn input cleaner, fallback parser, and localStorage helpers.

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

// Strip LinkedIn Ctrl+A / Ctrl+C sidebar, navigation, "Connected apps",
// "People you may know", and footer boilerplate before sending text to AI
// or the offline fallback parser.
export function cleanInputText(raw) {
  let text = (raw || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/…\s*more\b/gi, '')
    .replace(/\bshow all\b/gi, '');

  // Preserve a trailing Languages section if it appears after the LinkedIn sidebar
  const langTailMatch = text.match(/\nLanguages\n[\s\S]{1,160}$/i);
  const sidebarRe =
    /\b(Top Voices|Profile language|Public profile & URL|Who your viewers also viewed|People you may know|You might like|Pages for you|LinkedIn Corporation ©|Accessibility\s+Talent Solutions)\b/i;
  const sideIdx = text.search(sidebarRe);
  if (sideIdx > 150) {
    text = text.slice(0, sideIdx) + (langTailMatch ? '\n' + langTailMatch[0] : '');
  }

  // Keep tool names from "Connected apps" under a clean Tools label, drop the widget CTA text
  text = text.replace(
    /Connected apps\s+Add the products you use to stand out and get more profile views\./gi,
    'Tools:'
  );
  text = text.replace(/Add connected apps/gi, '');

  const dropLineRe =
    /^(Search|Home|My Network|Jobs|Messaging|Notifications|For Business|Try Premium.*|LinkedIn|Website|Contact info|Follow|Connect|Message|More|View|Add|Show all|Questions\?|Visit our Help Center\.?)$/i;

  return text
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l) => l && !dropLineRe.test(l))
    .join('\n');
}

// Fallback resume used only when every AI provider is unavailable.
export function demoResumeFromText(rawText) {
  const text = cleanInputText(rawText);
  const r = emptyResume();

  const junkRe =
    /^(page \d+ of \d+|contact.*|about|summary|experience|education|skills|projects(\s*\(\d+\))?|languages(\s*\(\d+\))?|certifications|honors?\s*-?\s*awards|top skills|interests|linkedin|©.*|search|website)$/i;
  const urlRe = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|in|io|dev|org|net|ai|me)\b/i;
  const locRe = /^[A-Z][a-zA-Z .]+,\s*[A-Z][a-zA-Z .]+(,\s*[A-Z][a-zA-Z .]+)?$/;

  const rawLines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const lines = rawLines
    .map((l) =>
      l.replace(/\s*·\s*\d+\s*(yrs?|years?|mos?|months?)(\s+\d+\s*(yrs?|years?|mos?|months?))?\s*$/i, '').trim()
    )
    .filter((l) => l && !junkRe.test(l));

  // Contact info
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

  // Name & title
  const nameTitleLines = lines.filter(
    (l) =>
      !urlRe.test(l) &&
      !/\(linkedin\)/i.test(l) &&
      !locRe.test(l) &&
      !/\(/.test(l) &&
      l.length > 1 &&
      l.length < 60 &&
      !/^\d/.test(l) &&
      (l.match(/\S+/g) || []).length <= 6
  );

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
  } else {
    r.name = nameTitleLines[0] || 'Your Name';
  }

  r.location =
    lines.find((l) => locRe.test(l) && l.length < 60) || '';

  // Languages
  const langMap = [
    ['english', /english[^.\n]{0,40}?(full professional|professional|native|bilingual)/i, 'Professional'],
    ['hindi', /hindi[^.\n]{0,40}?(native|bilingual)/i, 'Native or Bilingual'],
    ['english', /english/i, 'Professional'],
    ['hindi', /hindi/i, 'Native'],
  ];
  const seenLangs = new Set();
  for (const [name, re, prof] of langMap) {
    if (re.test(text) && !seenLangs.has(name)) {
      seenLangs.add(name);
      r.languages.push({ name: name[0].toUpperCase() + name.slice(1), proficiency: prof });
    }
  }

  // Skills
  const skillsMatch = text.match(/Skills(?:\s*\(\d+\))?\s+([\s\S]{5,300}?)(?=Languages|Education|Projects|Experience|$)/i);
  if (skillsMatch) {
    r.skills = skillsMatch[1]
      .split(/\s{2,}|,|\n/)
      .map((s) => s.replace(/\s*\(.*?\)\s*/g, ' ').trim())
      .filter((s) => s.length > 2 && s.length < 36)
      .slice(0, 12);
  }

  // Experience
  const dateRe =
    /^((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4})\s*[–—-]\s*((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4}|present)\.?$/i;

  const isRoleJunk = (l) =>
    !l || urlRe.test(l) || /\(linkedin\)/i.test(l) || locRe.test(l) || junkRe.test(l) || /^\d/.test(l) || l.length > 75;

  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (dateRe.test(lines[i])) {
      const date = lines[i];
      let roleLine = '';
      let companyLine = '';
      for (let k = i - 1; k >= 0 && k >= i - 2; k--) {
        if (isRoleJunk(lines[k])) continue;
        const parts = lines[k].split(/\s+[–—-]\s+/);
        if (parts.length === 2) {
          roleLine = parts[0].trim();
          companyLine = parts[1].trim();
          break;
        }
        if (!companyLine) companyLine = lines[k];
        else if (!roleLine) { roleLine = lines[k]; break; }
      }
      if (!roleLine && companyLine) {
        roleLine = companyLine;
        companyLine = '';
      }
      // Skip empty Career break entries
      if (/career break|professional development/i.test(`${roleLine} ${companyLine}`)) {
        continue;
      }
      let j = i + 1;
      const descLines = [];
      while (
        j < lines.length &&
        !dateRe.test(lines[j]) &&
        !/^(experience|education|skills|projects|languages)/i.test(lines[j])
      ) {
        descLines.push(lines[j]);
        j++;
      }
      blocks.push({ roleLine: roleLine || 'Professional', companyLine, date, descLines });
      i = j - 1;
    }
  }

  r.experience = blocks.map((b) => {
    const [start, end] = b.date.split(/\s*[–—-]\s*/);
    const bullets = b.descLines
      .filter((l) => !urlRe.test(l) && !locRe.test(l))
      .join(' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15 && !/^page \d+/i.test(s))
      .slice(0, 4);

    return {
      company: b.companyLine || 'Self-employed',
      role: b.roleLine || 'Professional',
      start: start?.trim() || '',
      end: end?.trim() || '',
      location: '',
      bullets: bullets.length
        ? bullets
        : ['Describe your key responsibilities and achievements in this role.'],
    };
  });

  if (!r.title && r.experience.length) {
    r.title = r.experience[0].role;
  }

  // Summary
  const summaryMatch = text.match(/(?:Summary|About)\n([^]{30,600}?)(?=\n(?:Experience|Education|Skills|Projects)|$)/i);
  r.summary = summaryMatch
    ? summaryMatch[1].replace(/\n+/g, ' ').trim().slice(0, 400)
    : `${r.title || 'Professional'} focused on delivering reliable, high-impact work.`;

  // Education
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
