import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync } from 'fs';
import { extractTextFromPDF } from '../lib/resume-parser/pdf-extractor.js';
import { callAI } from '../lib/ai-gateway/index.js';
import { pdfParserSystemPrompt } from '../features/resume-toolkit/services/ai/prompts.js';

async function test() {
  const pdfPath = '/Users/laxmansirvi/Downloads/laxman_resume.pdf';
  const pdfBuffer = readFileSync(pdfPath);
  const text = await extractTextFromPDF(pdfBuffer.buffer as ArrayBuffer);
  
  const aiResult = await callAI({
    systemPrompt: pdfParserSystemPrompt,
    userPrompt: `Extract my resume into the template format provided. Output strictly valid JSON.\n\n${text}`,
    maxTokens: 8000,
    temperature: 0.1,
    outputFormat: 'json',
  }, {
    feature: 'resume_parser',
    userId: 'test-user',
  }, 'groq'); // FORCE GROQ!
  
  let jsonStr = aiResult.content;
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }
  
  console.log("RAW AI EDUCATION:");
  console.dir(JSON.parse(jsonStr).education, { depth: null });
}

test().catch(console.error);
