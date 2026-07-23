import { config } from 'dotenv';
config({ path: '.env.local' });
import Groq from 'groq-sdk';

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
async function test() {
  try {
    const completion = await groqClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Say hello in JSON format: {"message":"hello"}' }],
      response_format: { type: 'json_object' }
    });
    console.log("Success:", completion.choices[0].message.content);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
test();
