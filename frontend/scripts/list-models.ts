import { config } from 'dotenv';
config({ path: '.env.local' });

async function list() {
  try {
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await response.json();
    console.log(data.models.map((m: any) => m.name).join('\n'));
  } catch (e) {
    console.error(e);
  }
}
list();
