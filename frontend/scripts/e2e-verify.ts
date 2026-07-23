import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  console.log('1. Setting up test user...');
  const testEmail = 'test_e2e_' + Date.now() + '@example.com';
  const testPassword = 'password123';
  
  const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true
  });
  if (createError) throw new Error('Create user failed: ' + createError.message);

  const { data: auth, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  if (signInError) throw new Error('Sign in failed: ' + signInError.message);

  const projectId = supabaseUrl.split('//')[1].split('.')[0];
  const cookieName = `sb-${projectId}-auth-token`;
  const sessionData = JSON.stringify(auth.session);
  const cookieString = `${cookieName}=${encodeURIComponent(sessionData)}`;

  console.log('2. Testing PDF Parse Endpoint (/api/resume/parse)...');
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument();
  doc.text('John Doe\nSoftware Engineer\nExperience: 5 years in Node.js and React.\nI have extensive experience working with Supabase and creating scalable frontends.');
  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.end();
  });

  const formData = new FormData();
  formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'resume.pdf');

  const parseRes = await fetch('http://localhost:3000/api/resume/parse', {
    method: 'POST',
    headers: {
      Cookie: cookieString
    },
    body: formData
  });

  if (!parseRes.ok) {
    const text = await parseRes.text();
    throw new Error(`Parse failed: ${parseRes.status} - ${text}`);
  }
  const parsedData = await parseRes.json();
  console.log('Parse successful! Extracted Name:', parsedData.basics?.name);
  console.log('JSON structure keys:', Object.keys(parsedData));

  // 3. Test ATS Endpoint (/api/resume/ats-check)...
  console.log('3. Testing ATS Score Checker Endpoint (/api/resume/ats-check)...');
  
  // Create a resume record in the database so the ATS endpoint can fetch it by ID
  const { data: resume, error: insertError } = await supabaseAdmin
    .from('resumes')
    .insert({
      title: 'Test Resume',
      user_id: user.user.id,
      parsed_data: parsedData
    })
    .select('id')
    .single();
    
  if (insertError) throw new Error('Failed to insert test resume: ' + insertError.message);

  const atsRes = await fetch('http://localhost:3000/api/resume/ats-check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieString
    },
    body: JSON.stringify({
      resumeId: resume.id,
      jobDescription: 'We are looking for a Software Engineer with at least 5 years of experience in Node.js and React. You must be comfortable with Supabase, PostgreSQL, and scalable frontends. Experience with AWS is a plus.',
      companyName: 'Acme Corp'
    })
  });

  if (!atsRes.ok) {
    const text = await atsRes.text();
    throw new Error(`ATS Check failed: ${atsRes.status} - ${text}`);
  }
  const atsData = await atsRes.json();
  console.log('ATS Check successful! Score:', atsData.score);
  console.log('ATS Recommendation:', atsData.recommendation);
  console.log('Keyword Analysis Match count:', atsData.keywordAnalysis?.matched?.length);

  // Clean up test user
  await supabaseAdmin.auth.admin.deleteUser(user.user.id);
  console.log('All E2E tests passed successfully!');
}

run().catch(err => {
  console.error('E2E TEST FAILED:', err);
  process.exit(1);
});
