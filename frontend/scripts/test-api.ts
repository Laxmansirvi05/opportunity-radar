import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function testApi() {
  const filePath = '/Users/laxmansirvi/Downloads/laxman_resume.pdf';
  
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  console.log("Sending POST to http://localhost:3000/api/resume/parse...");
  const res = await fetch('http://localhost:3000/api/resume/parse', {
    method: 'POST',
    body: form,
  });

  console.log(`Status: ${res.status}`);
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    console.log(JSON.stringify(json, null, 2).substring(0, 500) + '...');
  } catch (e) {
    console.log(text);
  }
}

testApi().catch(console.error);
