import { NextResponse } from 'next/server';
import { demoResumeFromText } from '@/lib/resume';

// Tries each model in order. First successful response wins.
// If a model rejects `response_format`, retries once without it.
// Throws only if every model fails.
async function callOpenRouter(models, systemPrompt, userText, apiKey) {
  let lastError;

  for (const model of models) {
    // Attempt 1: with response_format; Attempt 2: without (some free
    // models reject the structured-output parameter)
    for (const useJsonFormat of [true, false]) {
      try {
        const body = {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText },
          ],
          temperature: 0.4,
        };
        if (useJsonFormat) body.response_format = { type: 'json_object' };

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
            'X-Title': 'ResumeRewire',
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`OpenRouter ${model} error:`, res.status, errText.slice(0, 300));
          lastError = new Error(`${model}: ${res.status} ${errText.slice(0, 200)}`);
          // Rate limit / quota — skip straight to the next model
          if (res.status === 429) break;
          continue;
        }

        const data = await res.json();
        if (data.choices?.[0]?.message?.content) {
          console.log(`Generate OK via model: ${model}`);
          return data;
        }
        lastError = new Error(`${model}: empty response`);
      } catch (err) {
        console.error(`OpenRouter ${model} request failed:`, err.message);
        lastError = err;
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

  // Fallback chain of free models — if the primary fails (rate limit,
  // unsupported params, transient error), we try the next one.
  // All are plain-text chat models: PDFs are parsed to text server-side
  // before reaching the AI, so no multimodal support is needed.
  const FALLBACK_MODELS = [
    model,
    'google/gemma-4-26b-a4b-it:free', // structured output support
    'google/gemma-4-31b-it:free',     // strong document understanding
    'openrouter/free',                // auto-router over free models
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  const systemPrompt = `You are an expert resume writer. Convert raw text (a LinkedIn profile, an old resume, or work history notes) into structured resume JSON.

Rules:
- Extract real facts only from the text. Never invent employers, degrees, dates, or metrics. If details are missing, leave fields empty rather than fabricating.
- MANDATORY: every role, job, internship or freelance engagement mentioned in the text MUST appear in the experience array. LinkedIn profiles have an "Experience" section — capture EVERY entry in it, with its exact dates and description. If no company name is given, use "Freelance" / "Self-employed". Never return an empty experience array if the text mentions any work.
- Use EVERYTHING useful in the text — interests, side projects, self-descriptions, languages, certifications — a resume must look complete and professional, not thin. Aim for a full page.
- For each experience entry, write 3-5 substantive bullet points. Draw out every distinct responsibility or achievement implied by the text (e.g. "I create incredibly good websites for recruiters, local businesses, and big tech companies" implies client delivery, requirement gathering, responsive design, stakeholder communication). Split compound sentences into separate bullets. You may polish and expand wording, but every bullet must be traceable to the text.
- summary: 3-4 sentences positioning the person for their target role, written in first person implied tone (no "I" spam), pulling in their stated interests and focus areas.
- skills: flat array of concrete skills/tools/domains, max 15. Preserve ALL skills mentioned in the text.
- languages: array of {name, proficiency} from the text if present.
- Dates format: "Jul 2023" style, or years. Keep date ranges as given.
- Clean up HTML entities (&amp; -> and) and artifacts from copy-paste.
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
    // Fall back to the demo resume rather than hard-failing —
    // the user still gets a working editor, and the message says what happened.
    return NextResponse.json({
      resume: demoResumeFromText(text),
      demo: true,
      notice: 'AI providers are busy right now — generated a draft you can edit. Try again in a minute for full AI output.',
    });
  }
}
