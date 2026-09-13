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
    // LinkedIn's PDF is a two-column layout that extracts poorly. Chasing
    // it with regexes makes things worse (mis-joined dates, duplicated
    // role/company). Instead: do MINIMAL cleanup and let the AI do the
    // structuring — the same reason paste-mode works so well.
    const raw = (data.text || '').trim();
    const text = raw
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter((l) => l && !/^page \d+ of \d+$/i.test(l))
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
