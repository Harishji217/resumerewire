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

// Naive demo resume used when no OPENROUTER_API_KEY is set,
// so the whole flow can be tested before adding a key.
export function demoResumeFromText(text) {
  const r = emptyResume();
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  const phoneMatch = text.match(/(\+?\d[\d\s-]{8,}\d)/);

  r.name = lines[0] || 'Your Name';
  r.title = lines[1] || 'Your Professional Title';
  r.email = emailMatch ? emailMatch[0] : 'you@example.com';
  r.phone = phoneMatch ? phoneMatch[1] : '';
  r.summary =
    'This is a demo resume generated without an AI key. Add your OPENROUTER_API_KEY in .env.local to get real AI-structured output. ' +
    (text.slice(0, 200) || '');
  r.skills = ['Skill A', 'Skill B', 'Skill C', 'Skill D'];
  r.experience = [
    {
      company: 'Demo Company',
      role: r.title,
      start: 'Jan 2023',
      end: 'Present',
      location: '',
      bullets: [
        'Paste your LinkedIn profile or upload a PDF for real AI-generated bullet points.',
        'Add your OpenRouter key in .env.local to enable AI generation.',
      ],
    },
  ];
  r.education = [
    { school: 'Demo University', degree: 'B.Tech', start: '2019', end: '2023', details: '' },
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
