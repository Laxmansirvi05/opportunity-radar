import { readFileSync } from 'fs';
import { extractTextFromPDF } from '../lib/resume-parser/pdf-extractor.js';

async function test() {
  const pdfPath = '/Users/laxmansirvi/Downloads/laxman_resume.pdf';
  const pdfBuffer = readFileSync(pdfPath);
  const text = await extractTextFromPDF(pdfBuffer.buffer as ArrayBuffer);
  console.log(text.substring(0, 2000));
}

test().catch(console.error);
