// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'

// Use the worker from the local package
// In Next.js, configure this in next.config.ts to copy the worker to /public
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

// ---------------------------------------------------------------------------
// Extract raw text from a PDF buffer
// ---------------------------------------------------------------------------
export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: buffer })
  const pdf = await loadingTask.promise

  const pages: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()

    const pageText = textContent.items
      .filter((item: any): item is TextItem => 'str' in item)
      .map((item: TextItem) => item.str)
      .join(' ')
      .replace(/\s{3,}/g, '\n')  // Collapse excessive whitespace into newlines
      .trim()

    pages.push(pageText)
  }

  return pages.join('\n\n')
}

// ---------------------------------------------------------------------------
// Validate PDF buffer before extraction
// ---------------------------------------------------------------------------
export function validatePDFBuffer(buffer: ArrayBuffer): { valid: boolean; error?: string } {
  if (buffer.byteLength === 0) {
    return { valid: false, error: 'File is empty.' }
  }

  if (buffer.byteLength > 5 * 1024 * 1024) {
    return { valid: false, error: 'File exceeds 5MB limit.' }
  }

  // Magic bytes check: PDF files start with %PDF
  const bytes = new Uint8Array(buffer, 0, 5)
  const header = String.fromCharCode(...bytes)
  if (!header.startsWith('%PDF')) {
    return { valid: false, error: 'File does not appear to be a valid PDF.' }
  }

  return { valid: true }
}
