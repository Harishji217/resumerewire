import { NextResponse } from 'next/server';

// POST /api/extract-pdf
// Body: multipart/form-data with "file" = PDF
// Returns { text } extracted from the PDF, first ~30k chars.
export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let pdfParse;
    try {
      // NB: import the lib entry directly — the package root runs debug
      // code that reads a test file from disk and crashes on Vercel.
      pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    } catch {
      return NextResponse.json(
        { error: 'pdf-parse is not installed. Run npm install.' },
        { status: 500 }
      );
    }

    const data = await pdfParse(buffer);
    // Normalize PDF extraction artifacts so the AI gets clean input:
    // - rejoin words broken by hyphenation at line ends ("perfor-\nmance")
    // - collapse the hard line breaks pdf-parse keeps mid-sentence
    //   (PDFs have no paragraph concept; every visual line becomes \n)
    // - LinkedIn PDFs are two-column: a date line belongs to the job
    //   listed above/below it, so we re-associate "Job Title / Company /
    //   Jan 2020 - Present" triplets explicitly for the AI.
    const raw = (data.text || '').trim();
    const lines = raw
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const dateLine = (l) =>
      /^((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4})\s*(–|—|-|to)\s*((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4}|present)$/i.test(
        l
      );

    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (dateLine(l) && out.length) {
        // Attach the date to the previous line (role/company) so the
        // AI sees "Web Developer — Company | Jan 2020 – Present"
        out[out.length - 1] = `${out[out.length - 1]} | ${l}`;
      } else {
        out.push(l);
      }
    }

    const text = out
      .join('\n')
      .replace(/(\w)-\n(\w)/g, '$1$2')
      .replace(/([a-z,;])\n(?=[a-z(])/g, '$1 ')
      .replace(/\n{2,}/g, '\n')
      .slice(0, 30000);

    if (!text) {
      return NextResponse.json(
        { error: 'No extractable text found in PDF (it may be a scanned image).' },
        { status: 422 }
      );
    }
    return NextResponse.json({ text });
  } catch (err) {
    console.error('PDF extract error:', err);
    return NextResponse.json(
      { error: 'Could not read this PDF. Try pasting your text instead.' },
      { status: 500 }
    );
  }
}
