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
      pdfParse = (await import('pdf-parse')).default;
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
    const raw = (data.text || '').trim();
    const text = raw
      .replace(/(\w)-\n(\w)/g, '$1$2')        // de-hyphenate
      .replace(/([a-z,;])\n(?=[a-z(])/g, '$1 ') // join sentence-internal breaks
      .replace(/\n{2,}/g, '\n')               // collapse blank-line runs
      .replace(/[ \t]+/g, ' ')
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
