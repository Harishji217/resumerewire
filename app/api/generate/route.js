import { NextResponse } from 'next/server';
import { cleanInputText, demoResumeFromText } from '@/lib/resume';

export const maxDuration = 60;

// Google AI Studio (Gemini) — free tier with private per-key limits.
// Cycles through active free Flash-Lite / Flash / Gemma models with short
// retries on transient 503/429 spikes so temporary load never fails a request.
async function callGemini(systemPrompt, userText, apiKey) {
  const models = [
    process.env.GEMINI_MODEL,
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemma-4-31b-it',
    'gemma-4-26b-a4b-it',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  let lastError;
  for (const model of models) {
    const isGemma = model.startsWith('gemma-');
    const maxAttempts = model.includes('flash-lite') ? 2 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 16000);
      try {
        const payload = isGemma
          ? {
              contents: [
                { role: 'user', parts: [{ text: systemPrompt + '\n\n--- SOURCE TEXT ---\n' + userText }] },
              ],
              generationConfig: { temperature: 0.3, maxOutputTokens: 2500 },
            }
          : {
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: 'user', parts: [{ text: userText }] }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2500,
                responseMimeType: 'application/json',
              },
            };

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=` +
            encodeURIComponent(apiKey),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);

        if (!res.ok) {
          const errText = await res.text();
          console.error(`Gemini ${model} error:`, res.status, errText.slice(0, 300));
          lastError = new Error(`Gemini ${model}: ${res.status}`);
          if ((res.status === 503 || res.status === 429) && attempt + 1 < maxAttempts) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          break;
        }

        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) {
          lastError = new Error(`Gemini ${model}: empty response`);
          break;
        }
        console.log(`Generate OK via Gemini model: ${model}`);
        return { choices: [{ message: { content } }] };
      } catch (err) {
        clearTimeout(timeout);
        console.error(`Gemini ${model} request failed:`, err.message);
        lastError = err;
        break;
      }
    }
  }
  throw lastError || new Error('All Gemini models failed');
}

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
          temperature: 0.3,
          max_tokens: 2200,
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 16000);

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
          if (res.status === 429 && attempt === 0) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          break;
        }

        const data = await res.json();
        if (data.choices?.[0]?.message?.content) {
          console.log(`Generate OK via model: ${model}`);
          return data;
        }
        lastError = new Error(`${model}: empty response`);
        break;
      } catch (err) {
        console.error(`OpenRouter ${model} request failed:`, err.message);
        lastError = err;
        break;
      }
    }
  }
  throw lastError || new Error('All models failed');
}

// POST /api/generate
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rawText = (body.text || '').trim();
  if (!rawText) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }
  if (rawText.length > 30000) {
    return NextResponse.json(
      { error: 'Text too long (max 30000 chars)' },
      { status: 400 }
    );
  }

  const cleanedText = cleanInputText(rawText);
  const apiKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!apiKey && !geminiKey) {
    const demo = demoResumeFromText(cleanedText);
    return NextResponse.json({ resume: demo, demo: true });
  }

  const model = process.env.AI_MODEL || 'openrouter/free';
  const FALLBACK_MODELS = [
    model,
    'google/gemma-4-26b-a4b-it:free',
    'openrouter/free',
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  const systemPrompt = `You are a senior technical recruiter and ATS resume editor. Transform raw profile text (LinkedIn copy-paste, PDF resume, or notes) into a crisp, authentic, hireable 1-page ATS resume JSON.

CRITICAL QUALITY RULES (avoid generic "AI slop"):
1. STRICT FACTUALITY: Only include employers, roles, dates, degrees, skills, and projects actually supported by the source text. NEVER invent metrics, percentages, employers, or tools not mentioned or directly implied by their real work.
2. IGNORE PLATFORM NOISE: Completely ignore any leftover LinkedIn UI clutter ("Search", "Connected apps", "Top Voices", "People you may know", "Who your viewers also viewed", "Pages for you", "Show all", follower counts, unrelated people/companies).
3. NO FAKE "CAREER BREAK" JOBS: If the text has an empty "Career break" / "Professional development" entry with no real deliverables, OMIT it from experience (do not invent buzzword bullets for it). Fold genuine ongoing building/learning focus naturally into the summary.
4. NATURAL, HUMAN, RECRUITER-READY VOICE:
   - summary: Write 2-3 concise, direct sentences in implied first-person resume voice (NEVER third-person like "Harish Pal is..." or "He spends..."). Frame their actual role, capabilities, and focus cleanly for hiring managers without hype words ("incredibly good", "enthusiast experimenting", "paradigms", "cutting-edge", "synergy").
   - title: Concise professional target role derived strictly from the candidate's actual work and summary (e.g., "Web Developer & AI Builder").
   - experience: Rewrite casual/broken prose into 2-4 concrete, specific, action-verb bullets ("Designed and built...", "Developed...", "Delivered..."). Fix typos and grammar cleanly. Each bullet should describe real work done, audience served, or capability delivered — NEVER pad thin roles with generic filler like "requirements gathering, quality standards, and stakeholder communication".
   - projects: Extract every real project mentioned. Fix typos in project names (e.g., "Webite for Dentists" -> "Dental Clinic Showcase Website") and write a sharp 1-2 sentence description of what was built and why it matters.
   - skills: 6-12 concrete, ATS-relevant skills derived from the profile. Exclude vague filler or platform widgets.
   - languages: Array of {name, proficiency} with clean proficiency labels.
   - Keep dates concise ("Jul 2023" - "Aug 2026", or "Present").

Return ONLY valid JSON, no markdown fences, in this exact shape:
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
    const attempts = [];
    if (geminiKey) {
      attempts.push(() => callGemini(systemPrompt, cleanedText, geminiKey));
    }
    if (apiKey) {
      attempts.push(() =>
        callOpenRouter(FALLBACK_MODELS, systemPrompt, cleanedText, apiKey)
      );
    }

    let parsed = null;
    for (const attempt of attempts) {
      try {
        const aiData = await attempt();
        const content = aiData.choices?.[0]?.message?.content;
        if (!content) throw new Error('empty response');

        try {
          parsed = JSON.parse(content);
        } catch {
          const match = content.match(/\{[\s\S]*\}/);
          if (!match) throw new Error('malformed JSON');
          parsed = JSON.parse(match[0]);
        }
        if (parsed) break;
      } catch (err) {
        console.error('AI provider failed:', err.message);
      }
    }

    if (!parsed) {
      return NextResponse.json({
        resume: demoResumeFromText(cleanedText),
        demo: true,
        notice:
          'The AI service was busy, so this is a quick draft parsed from your text. ' +
          'Try generating again in a minute for the fully written version.',
      });
    }

    for (const key of ['skills', 'experience', 'education', 'projects', 'languages', 'links']) {
      if (!Array.isArray(parsed[key])) parsed[key] = [];
    }
    parsed.experience = parsed.experience
      .filter((e) => !/career break/i.test(`${e.company || ''} ${e.role || ''}`))
      .map((e) => ({
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
    return NextResponse.json({
      resume: demoResumeFromText(cleanedText),
      demo: true,
      notice:
        'The AI service was busy or rate-limited, so this is a quick draft parsed from your text. ' +
        'Try generating again in a minute for the fully written version.',
    });
  }
}
