import { config } from 'dotenv';
config({ path: '.env.local' });
import Groq from 'groq-sdk';

async function list() {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  try {
    const models = await groq.models.list();
    console.log(models.data.map((m: any) => m.id).join('\n'));
  } catch (e) {
    console.error(e);
  }
}
list();
