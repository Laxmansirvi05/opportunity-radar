import { config } from 'dotenv';
config({ path: '.env.local' });
import { callAI } from './lib/ai-gateway/index.js';
import { pdfParserSystemPrompt } from './features/resume-toolkit/services/ai/prompts.js';

async function test() {
  console.log("Testing AI Gateway...");
  const result = await callAI({
    systemPrompt: pdfParserSystemPrompt,
    userPrompt: 'You must output valid JSON.\n\nJohn Doe\nSoftware Engineer\njohndoe@email.com\n(123) 456-7890\nMountain View, CA\n\nExperience:\nGoogle - Software Engineer (Jan 2018 - Jan 2023)\n- Developed cool things\n\nEducation:\nStanford University - B.S. CS (2014 - 2018)\n\nSkills:\nJava, Python, C++',
    maxTokens: 8000,
    temperature: 0.1,
    outputFormat: 'json',
  }, {
    feature: 'resume_parser',
    userId: 'test-user',
  });
  
  console.log("Result:", result.provider, result.success, result.reason);
  if (result.success) {
    console.log("Success with model:", (result as any).model);
    console.log(result.content.slice(0, 100) + '...');
  }
}
test();
