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
// Parses what it can from the raw text so the resume still looks real
// and fills a full page — never a thin placeholder.
export function demoResumeFromText(text) {
  const r = emptyResume();
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  const phoneMatch = text.match(/(\+?\d[\d\s-]{8,}\d)/);
  const linkMatch = text.match(/(https?:\/\/)?(www\.)?(linkedin\.com|github\.com|github\.io)\/[\w\-./]+/i);

  r.name = lines[0] || 'Your Name';
  r.title = lines[1] || 'Your Professional Title';
  r.email = emailMatch ? emailMatch[0] : 'you@example.com';
  r.phone = phoneMatch ? phoneMatch[1] : '';
  r.location = lines.find((l) => /,\s*(India|USA|UK|Delhi|Mumbai|Bangalore|Hyderabad|Chennai|Pune)/i.test(l)) || '';
  r.links = linkMatch ? [{ label: 'LinkedIn', url: linkMatch[0] }] : [];

  // Pull languages if mentioned
  const langs = [];
  if (/english/i.test(text)) langs.push({ name: 'English', proficiency: 'Professional' });
  if (/hindi/i.test(text)) langs.push({ name: 'Hindi', proficiency: 'Native' });
  r.languages = langs;

  // Naive experience extraction: any line with a date range treated as a role header
  const dateRe = /((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4})\s*[–—-]{1,2}\s*((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4}|present)/i;
  const expIdx = [];
  lines.forEach((l, i) => {
    if (dateRe.test(l) && i > 1) expIdx.push(i);
  });

  if (expIdx.length) {
    r.experience = expIdx.map((idx, k) => {
      const header = lines[idx];
      const nextIdx = expIdx[k + 1] || lines.length;
      // Role title is usually the line above the date line; description follows
      const roleLine = lines[idx - 1] || header;
      const desc = lines
        .slice(idx + 1, Math.min(idx + 6, nextIdx))
        .filter((l) => !dateRe.test(l) && l.length > 25)
        .join(' ');
      return {
        company: /at\s+(.+)/i.exec(roleLine)?.[1] || (roleLine === header ? 'Independent' : roleLine),
        role: roleLine === header ? 'Professional' : roleLine,
        start: (dateRe.exec(header) || [])[0]?.split(/[–—-]/)[0]?.trim() || '',
        end: (dateRe.exec(header) || [])[0]?.split(/[–—-]/)[1]?.trim() || '',
        location: '',
        bullets: desc
          ? desc
              .split(/(?<=\.)\s+/)
              .filter((s) => s.trim().length > 10)
              .slice(0, 4)
              .map((s) => s.trim())
          : [
              'Delivered high-quality work for clients across multiple engagements.',
              'Collaborated with stakeholders to gather requirements and translate them into deliverables.',
              'Maintained consistent quality standards throughout the engagement.',
            ],
      };
    });
  } else {
    r.experience = [
      {
        company: 'Independent / Freelance',
        role: r.title,
        start: '2023',
        end: 'Present',
        location: '',
        bullets: [
          'Delivered professional work for recruiters, local businesses, and technology companies.',
          'Gathered client requirements and translated them into polished final deliverables.',
          'Maintained strong client relationships through consistent communication and quality delivery.',
        ],
      },
    ];
  }

  // Skills: lines after a "Skills" heading, or comma-separated lists
  const skillsIdx = lines.findIndex((l) => /^skills?\b/i.test(l));
  if (skillsIdx >= 0) {
    const skillText = lines.slice(skillsIdx + 1, skillsIdx + 6).join(' ');
    r.skills = skillText
      .split(/[,\n•]/)
      .map((s) => s.replace(/\(.*?\)/g, '').trim())
      .filter((s) => s.length > 2 && s.length < 40)
      .slice(0, 12);
  }
  if (!r.skills.length) {
    r.skills = ['Project Management', 'Information Technology', 'Web Development', 'Communication', 'Problem Solving'];
  }

  // Summary: use a chunk of the text if it looks like a bio
  const bioChunk = text.slice(0, 600).replace(/\s+/g, ' ').trim();
  r.summary =
    bioChunk.length > 150
      ? bioChunk.slice(0, 500)
      : `${r.title} with hands-on experience delivering quality work for diverse clients. Focused on continuous improvement, clear communication, and dependable execution.`;

  r.education = [
    { school: 'Add your school', degree: 'Add your degree', start: '', end: '', details: '' },
  ];
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
