# ResumeRewire

AI resume builder — the "rejected to hired" product built following Sanskar's playbook from the video.

**Completely free:** no payments, no sign-up, no accounts. Resumes are stored only in the user's browser.

**Flow:** Landing page → Dashboard → Create (paste LinkedIn text / upload PDF) → AI structures it → Live editor (form left, preview right, 4 templates) → Free PDF export.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the whole flow works in **demo mode** (no AI key needed; a placeholder resume is generated).

## Enable real AI generation

1. Create an account at https://openrouter.ai and create an API key at https://openrouter.ai/keys
2. `cp .env.example .env.local` and set `OPENROUTER_API_KEY=sk-or-...`
3. `AI_MODEL` defaults to `meta-llama/llama-3.3-70b-instruct:free` — a **free model**, zero cost per request

Free models have rate limits (roughly a few dozen requests/day per key). If you hit them, switch `AI_MODEL` to a cheap paid one like `google/gemini-2.5-flash` — still a fraction of a cent per resume.

## Design rules (from the video)

- Outfit font
- No gradients
- No blue — ink black + warm off-white + orange accent
- Sharp edges (border-radius: 0)
- Templates must work at full A4 and in the editor preview

## Stack

| Piece | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Landing + app + SEO pages in one |
| AI | OpenRouter API | One key, any model, free models available |
| PDF text extraction | pdf-parse (server-side) | Simple, no browser deps |
| PDF export | window.print() with @media print CSS | Zero cost, clean A4 output |
| Storage | localStorage | No server, no accounts, fully private |
| Payments | None — completely free | Per the owner's decision |

## Going live — the Sanskar playbook

### 3. SEO (this is how Rezi grew — organic search)

- Find long-tail keywords with keyword difficulty ≤ 20 (Ahrefs, or free: Google Keyword Planner + AnswerThePublic)
- Look for overlooked languages/regions — the video found "ATS friendly resume" in **Arabic**: 3K monthly searches, difficulty 0
- Build a page per keyword (native-language slug, screenshots, step-by-step) — ask Claude Code to generate them
- Add sitemap (already included at `/sitemap.xml`) + canonical URLs + Google Search Console
- YouTube tutorials beat blog posts for a new domain — you borrow YouTube's authority. Make one video per target keyword
- Post your site on launch lists for backlinks (Sanskar has a "100+ places to launch" list on his site, sanskardewari.io)

### 4. Deploy

Sanskar's recommendation: **Cloudflare** (free tier is generous for a solo builder).

```bash
npm install -g wrangler
wrangler login
# then ask Claude Code to set up @opennextjs/cloudflare and deploy
```

Buy the domain (.com or .app only — he was explicit: nothing else) and connect it in the Cloudflare dashboard.

## File map

```
app/
  page.js                 Landing (hero, how-it-works, templates, story, FAQ)
  dashboard/page.js       Resume list + Create New
  create/page.js          Input: paste text / upload PDF + template picker
  editor/page.js          Live editor: form left, preview right, free export
  api/generate/route.js   POST text -> OpenRouter -> structured resume JSON
  api/extract-pdf/route.js  POST PDF -> extracted text
  globals.css             Design system (no gradients, no blue, sharp edges)
components/
  ResumeSheet.js          4 templates (classic/modern/compact/bold)
lib/
  resume.js               Schema, demo fallback, localStorage helpers
```
