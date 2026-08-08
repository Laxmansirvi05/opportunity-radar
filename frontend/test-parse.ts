import fs from 'fs';
import { extractTextFromPDF } from './lib/resume-parser/pdf-extractor';

async function test() {
  const buffer = fs.readFileSync('/Users/laxmansirvi/Downloads/laxman_resume.pdf');
  const text = await extractTextFromPDF(buffer.buffer as ArrayBuffer);
  fs.writeFileSync('parsed_pdf.txt', text);
  console.log("Done");
}
test();
