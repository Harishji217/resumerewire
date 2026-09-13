import { NextResponse } from 'next/server';
import { demoResumeFromText } from '@/lib/resume';

// Tries each model in order, one attempt each, with a hard timeout.
// On a rate limit (429), waits briefly and retries that model once —
// free-tier limits are often momentary, so a short backoff usually
// succeeds instead of abandoning the model entirely.
async function callOpenRouter(models, systemPrompt, userText, apiKey) {
  let lastError;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const body = {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText },
          ],
          temperature: 0.4,
          // Cap output length — generation time is dominated by output
          // tokens, and 2200 is ample for a 1-2 page resume JSON.
          max_tokens: 2200,
        };

        // Hard cap: 25s per model. Free models queue under load; without
        // this the user waits on a single hung request forever.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
            'X-Title': 'ResumeRewire',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          const errText = await res.text();
          console.error(`OpenRouter ${model} error:`, res.status, errText.slice(0, 300));
          lastError = new Error(`${model}: ${res.status} ${errText.slice(0, 200)}`);
          // Momentary rate limit: brief backoff, one retry on this model
          if (res.status === 429 && attempt === 0) {
            await new Promise((r) => setTimeout(r, 2500));
            continue;
          }
          break; // next model
        }

        const data = await res.json();
        if (data.choices?.[0]?.message?.content) {
          console.log(`Generate OK via model: ${model}`);
          return data;
        }
        lastError = new Error(`${model}: empty response`);
        break; // next model
      } catch (err) {
        console.error(`OpenRouter ${model} request failed:`, err.message);
        lastError = err;
        break; // next model
      }
    }
  }
  throw lastError || new Error('All models failed');
}


// POST /api/generate
// Body: { text: string }  ->  structured resume JSON
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const text = (body.text || '').trim();
  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }
  if (text.length > 30000) {
    return NextResponse.json(
      { error: 'Text too long (max 30000 chars)' },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  // Clean common copy-paste artifacts before sending to the AI
  const cleanedText = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ');

  // No key configured -> return demo resume so the whole flow is testable.
  if (!apiKey) {
    const demo = demoResumeFromText(cleanedText);
    return NextResponse.json({ resume: demo, demo: true });
  }

  const model = process.env.AI_MODEL || 'google/gemma-4-26b-a4b-it:free';

  // Fallback chain of free models — max 3, so worst-case total wait
  // stays under ~75s. All are plain-text chat models: PDFs and LinkedIn
  // pages are parsed to text server-side before reaching the AI.
  const FALLBACK_MODELS = [
    model,
    'google/gemma-4-26b-a4b-it:free', // structured output support
    'openrouter/free',                // auto-router over free models
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  const systemPrompt = `You are an expert resume writer. Convert raw text (a LinkedIn profile, an old resume, or work history notes) into structured resume JSON.

Rules:
- Extract real facts only from the text. Never invent employers, degrees, dates, or metrics. If details are missing, leave fields empty rather than fabricating.
- MANDATORY: every role, job, internship or freelance engagement mentioned in the text MUST appear in the experience array. LinkedIn profiles have an "Experience" section — capture EVERY entry in it, with its exact dates and description. If no company name is given, use "Freelance" / "Self-employed". Never return an empty experience array if the text mentions any work.
- CONSISTENT DEPTH: produce the same rich output whether the input is a pasted profile or a PDF resume. Even if the source describes a role in one thin sentence, decompose it into 3-4 substantive bullets covering distinct aspects implied by that sentence (client delivery, requirements gathering, design, technology, quality standards, stakeholder communication, maintenance). Every bullet must be traceable to the text, but express each distinct facet separately rather than one dense sentence.
- LENGTH BUDGET: the final resume MUST fit on 1-2 A4 pages, never more. Total: at most 2 experience entries with 3-4 bullets each, summary max 3 sentences, skills max 12, at most 2 projects. If the text contains more roles than fit, keep the most recent/important ones. Prioritize substance over padding — never pad to fill space.
- Expand skills thoughtfully: include every skill, tool, domain and competency mentioned or clearly implied by the work described (e.g. building websites implies Web Design, Responsive Design, SEO fundamentals). Max 12, no duplicates or near-duplicates.
- languages: array of {name, proficiency} — extract from the text if present, with exact proficiency wording when given (e.g. "Full Professional", "Native or Bilingual").
- Use EVERYTHING useful in the text — interests, side projects, self-descriptions, certifications — a resume must look complete and professional, not thin. Aim for a full page.
- For each experience entry, write 3-4 substantive bullet points. Split compound sentences into separate bullets. You may polish and expand wording, but every bullet must be traceable to the text.
- Every project, portfolio site, or client deliverable mentioned (even inside experience descriptions) should ALSO appear in the projects array with a name and description. At most 2 projects.
- summary: 3-4 sentences positioning the person for their target role, written in third person, pulling in their stated interests and focus areas.
- Dates format: "Jul 2023" style, or years. Keep date ranges as given.
- Clean up HTML entities (&amp; -> and) and artifacts from copy-paste or PDF extraction (stray hyphens mid-word, broken line fragments).
- title: a single professional line, e.g. "AI Builder & Web Developer". If the text has a multi-part headline, condense it.

Return ONLY valid JSON, no markdown fences, in exactly this shape:
{
  "name": "",
  "title": "",
  "email": "",
  "phone": "",
  "location": "",
  "links": [{"label": "", "url": ""}],
  "summary": "",
  "skills": ["", ""],
  "languages": [{"name": "", "proficiency": ""}],
  "experience": [{"company": "", "role": "", "start": "", "end": "", "location": "", "bullets": ["", ""]}],
  "education": [{"school": "", "degree": "", "start": "", "end": "", "details": ""}],
  "projects": [{"name": "", "description": "", "link": ""}]
}`;

  try {
    const aiData = await callOpenRouter(FALLBACK_MODELS, systemPrompt, cleanedText, apiKey);

    const content = aiData.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'Empty response from AI' },
        { status: 502 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Some models wrap JSON in fences despite instructions
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        return NextResponse.json(
          { error: 'AI returned malformed JSON' },
          { status: 502 }
        );
      }
      parsed = JSON.parse(match[0]);
    }

    // Safety net: coerce the AI's output into well-formed arrays so the
    // editor never crashes on missing/malformed fields
    for (const key of ['skills', 'experience', 'education', 'projects', 'languages', 'links']) {
      if (!Array.isArray(parsed[key])) parsed[key] = [];
    }
    parsed.experience = parsed.experience.map((e) => ({
      company: e.company || '',
      role: e.role || e.title || '',
      start: e.start || '',
      end: e.end || '',
      location: e.location || '',
      bullets: Array.isArray(e.bullets) ? e.bullets.filter(Boolean) : [],
    }));

    return NextResponse.json({ resume: parsed, demo: false });
  } catch (err) {
    console.error('Generate error:', err);
    // Fall back to the parser resume rather than hard-failing —
    // the user still gets a working editor, and the notice tells
    // them what happened so it never looks like a bug.
    return NextResponse.json({
      resume: demoResumeFromText(text),
      demo: true,
      notice:
        'The AI service was busy or rate-limited, so this is a quick draft parsed from your text. ' +
        'Try generating again in a minute for the fully written version.',
    });
  }
}
