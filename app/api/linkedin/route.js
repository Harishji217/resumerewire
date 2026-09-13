import { NextResponse } from 'next/server';

// POST /api/linkedin
// Body: { url } -> { text } scraped from the public LinkedIn profile,
// or a helpful error when LinkedIn blocks the request (common — they
// serve a login wall to most non-browser traffic).
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const url = (body.url || '').trim();
  if (!/^https?:\/\/(www\.)?linkedin\.com\/in\/[\w\-%.]+/i.test(url)) {
    return NextResponse.json(
      { error: 'That does not look like a LinkedIn profile URL (it should be like linkedin.com/in/your-name).' },
      { status: 400 }
    );
  }

  // Follow the canonical /in/ URL; strip trackers
  const cleanUrl = url.split('?')[0].replace(/\/$/, '');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(cleanUrl, {
      headers: {
        // Browser-like headers give the best chance of getting the
        // public-profile page instead of the login wall
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            'LinkedIn blocked the request (they limit automated access). ' +
            'Instead: open your profile, press Ctrl+A then Ctrl+C, and paste the text here — same result.',
        },
        { status: 422 }
      );
    }

    const html = await res.text();

    // Login-wall detection: redirected pages are short and lack profile meta
    const isLoginWall =
      /authwall|login\?/i.test(res.url || '') ||
      (!/og:title"?\s+content="/i.test(html) && html.length < 40000);

    if (isLoginWall) {
      return NextResponse.json(
        {
          error:
            'LinkedIn served a login wall for this profile (private or rate-limited). ' +
            'Instead: open your profile, press Ctrl+A then Ctrl+C, and paste the text here — same result.',
        },
        { status: 422 }
      );
    }

    // Extract everything useful: OpenGraph meta tags first, then any
    // visible text content we can regex out of the public page.
    const meta = (prop) => {
      const re = new RegExp(
        `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`,
        'i'
      );
      const m = html.match(re);
      return m ? decodeEntities(m[1]) : '';
    };

    const parts = [];
    const title = meta('og:title');
    const headline = meta('twitter:title') || title;
    const description = meta('description') || meta('og:description');
    const locale = meta('og:locale');
    const siteName = meta('og:site_name');

    if (title) parts.push(title);
    if (headline && headline !== title) parts.push(headline);
    if (description) parts.push(description);
    if (locale) parts.push(`Locale: ${locale}`);

    // Public profile pages embed a JSON blob with the full profile for
    // included (public) sections — best source when present
    const jsonLd = html.match(
      /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i
    );
    if (jsonLd) {
      try {
        const ld = JSON.parse(jsonLd[1]);
        if (ld && typeof ld === 'object') {
          if (ld.name) parts.push(`Name: ${ld.name}`);
          if (ld.jobTitle) parts.push(`Title: ${ld.jobTitle}`);
          if (ld.description) parts.push(`Summary: ${ld.description}`);
          if (ld.address?.addressLocality)
            parts.push(`Location: ${ld.address.addressLocality}`);
        }
      } catch {
        // malformed JSON-LD — ignore, meta tags already captured
      }
    }

    // Strip tags from the visible body text as a last resort, keeping
    // section-ish lines (Experience, Education, Skills headings and
    // date-range lines survive this filter)
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .split('\n')
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 2 &&
          l.length < 120 &&
          !/^(Sign|Join|Log in|Learn|Add|Message|Follow|Connect|Dismiss|Cookie|Accept|Skip|English|Accessibility|Privacy|Terms|Help|About|©|Back|Next)/i.test(
            l
          )
      );

    // Prefer structured lines: dates, company/school patterns, section names
    const interesting = bodyText.filter((l) =>
      /((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4}\s*[–—-]\s*)|experience|education|skill|contact|about|linkedin\.com|@|university|college|institute|ltd|pvt|private|freelanc/i.test(
        l
      )
    );

    const scraped = [...parts, ...interesting.slice(0, 80)].join('\n').slice(0, 20000);

    if (scraped.replace(/\s/g, '').length < 80) {
      return NextResponse.json(
        {
          error:
            'Could not read enough from this profile (it may be mostly private). ' +
            'Instead: open your profile, press Ctrl+A then Ctrl+C, and paste the text here — same result.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: `LinkedIn profile data for ${siteName || 'profile'}:\n${scraped}`,
    });
  } catch (err) {
    clearTimeout(timeout);
    console.error('LinkedIn fetch error:', err.message);
    return NextResponse.json(
      {
        error:
          'Could not reach LinkedIn just now. ' +
          'Instead: open your profile, press Ctrl+A then Ctrl+C, and paste the text here — same result.',
      },
      { status: 502 }
    );
  }
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}
