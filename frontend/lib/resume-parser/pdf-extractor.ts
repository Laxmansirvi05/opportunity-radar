/**
 * lib/resume-parser/pdf-extractor.ts
 *
 * This module runs in Node.js (API routes / Server Actions).
 */

import PDFParser from 'pdf2json';

// ---------------------------------------------------------------------------
// Extract raw text from a PDF buffer
// ---------------------------------------------------------------------------
export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    // Instantiate with '1' to indicate we just want raw text
    const pdfParser = new (PDFParser as any)(null, 1);

    pdfParser.on('pdfParser_dataError', (errData: any) => reject(new Error(errData.parserError)));
    pdfParser.on('pdfParser_dataReady', () => {
      let text = pdfParser.getRawTextContent().replace(/\r\n/g, '\n');

      // Clean up page breaks which mess up line ordering
      text = text.replace(/----------------Page \(\d+\) Break----------------/g, '');

      // Heuristic: Did pdf2json extract the text bottom-up?
      // Resumes usually have contact info (email) or "About Me/Summary" at the top.
      const lines = text.split('\n').filter((l: string) => l.trim().length > 0);
      if (lines.length > 10) {
        const topQuarter = lines.slice(0, Math.floor(lines.length / 4)).join('\n').toLowerCase();
        const bottomQuarter = lines.slice(Math.floor(lines.length * 3 / 4)).join('\n').toLowerCase();

        const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
        const emailInTop = emailRegex.test(topQuarter);
        const emailInBottom = emailRegex.test(bottomQuarter);

        const summaryInBottom = bottomQuarter.includes("about me") || bottomQuarter.includes("summary");
        const summaryInTop = topQuarter.includes("about me") || topQuarter.includes("summary");

        // If email or summary is at the bottom but not top, it's upside down
        if ((emailInBottom && !emailInTop) || (summaryInBottom && !summaryInTop)) {
          text = text.split('\n').reverse().join('\n');
        }
      }

      resolve(text);
    });

    pdfParser.parseBuffer(Buffer.from(buffer));
  });
}

// ---------------------------------------------------------------------------
// Basic checks
// ---------------------------------------------------------------------------
export function validatePDFBuffer(buffer: ArrayBuffer) {
  if (buffer.byteLength === 0) return { valid: false, error: 'Empty file buffer' };
  const header = Buffer.from(buffer.slice(0, 5)).toString('utf-8');
  if (header !== '%PDF-') return { valid: false, error: 'Invalid PDF header' };
  return { valid: true };
}
