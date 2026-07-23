import { extractTextFromPDF, validatePDFBuffer } from '../lib/resume-parser/pdf-extractor';
import PDFDocument from 'pdfkit';

async function run() {
  console.log('Generating dummy PDF...');
  const doc = new PDFDocument();
  doc.text('John Doe\nSoftware Engineer\nExperience: 5 years in Node.js and React.');
  
  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.end();
  });

  const arrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength);

  console.log('Validating PDF...');
  const validation = validatePDFBuffer(arrayBuffer);
  if (!validation.valid) throw new Error(validation.error);

  console.log('Extracting text...');
  const text = await extractTextFromPDF(arrayBuffer);
  
  console.log('--- Extracted Text ---');
  console.log(text);
  console.log('----------------------');

  if (text.includes('John Doe') && text.includes('Software Engineer')) {
    console.log('SUCCESS: Text extraction works correctly.');
  } else {
    throw new Error('Extraction failed to find expected text.');
  }
}

run().catch(console.error);
