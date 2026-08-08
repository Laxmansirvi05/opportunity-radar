import fs from 'fs';
import { extractTextFromPDF } from './frontend/lib/resume-parser/pdf-extractor';
import { callAI } from './frontend/lib/ai-gateway/index';
import { pdfParserSystemPrompt, pdfParserUserPrompt } from './frontend/features/resume-toolkit/services/ai/prompts';
import { sanitizeAndParseResumeJson } from './frontend/features/resume-toolkit/services/ai/sanitize';
import { extractJDIntelligence, evaluateResumeEvidence } from './frontend/features/resume-toolkit/services/ai/ats-v2-intelligence';
import { calculateAtsV2Score } from './frontend/lib/ats-checker/scoring-v2';

import * as dotenv from 'dotenv';
dotenv.config({ path: './frontend/.env.local' });

const USER_ID = 'proof-user-id';
const PDF_PATH = '/Users/laxmansirvi/Downloads/laxman_resume.pdf';

const jobDescription = `We are seeking a motivated Frontend Developer Intern to join our engineering team.
Role & Responsibilities:
- Build responsive, user-friendly web interfaces using HTML, CSS, JavaScript, and React.
- Collaborate with design and backend teams using Git version control and code reviews.
- Integrate REST APIs to display real-time application data.
- Ensure cross-browser compatibility and basic performance optimization.
Qualifications & Skills:
- Currently pursuing a B.S. or B.Tech in Computer Science or related technical field.
- Hands-on experience with HTML, CSS, JavaScript, React, and Git.
- Basic understanding of API integration and responsive web development.`;

const targetRole = 'Frontend Developer Intern';
const companyName = 'InnovateTech';

async function run() {
  console.log('--- STARTING PIPELINE ---');
  const buffer = fs.readFileSync(PDF_PATH);
  
  // 1. Extract text
  const rawText = await extractTextFromPDF(buffer.buffer as ArrayBuffer);
  
  // 2. AI Parsing
  const parserValidator = (content: string) => {
    try {
      sanitizeAndParseResumeJson(content);
      return { valid: true as const };
    } catch (e: any) {
      return { valid: false as const, reason: e.message };
    }
  };

  const aiResult = await callAI(
    {
      systemPrompt: pdfParserSystemPrompt,
      userPrompt: `${pdfParserUserPrompt}\n\n${rawText.slice(0, 15000)}`,
      maxTokens: 8000,
      temperature: 0.1,
      outputFormat: 'json',
    },
    { feature: 'resume_parser', userId: USER_ID, validator: parserValidator }
  );

  if (!aiResult.success) {
    console.error('AI PARSING FAILED', aiResult.reason);
    return;
  }

  const { data: parsedResume } = sanitizeAndParseResumeJson(aiResult.content);
  
  console.log('=== EXTRACTED RESUME ===');
  console.log('SKILLS:', parsedResume.skills);
  console.log('PROJECTS:', parsedResume.projects.map(p => ({ name: p.name, tech: p.technologies })));
  console.log('EXPERIENCE:', parsedResume.experience.map(e => ({ role: e.role, company: e.company })));
  console.log('EDUCATION:', parsedResume.education.map(e => ({ degree: e.degree, field: e.field })));

  // 3. JD Intelligence
  const v2JdRes = await extractJDIntelligence(jobDescription, companyName, targetRole, USER_ID);
  if (!v2JdRes.success || !v2JdRes.data) {
    console.error('JD INTELLIGENCE FAILED', v2JdRes);
    return;
  }

  // 4. Evidence Evaluation
  const v2EvalRes = await evaluateResumeEvidence(parsedResume, v2JdRes.data, USER_ID);
  if (!v2EvalRes.success || !v2EvalRes.data) {
    console.error('EVIDENCE EVALUATION FAILED', v2EvalRes);
    return;
  }

  // 5. Score
  const v2Score = calculateAtsV2Score(v2JdRes.data, v2EvalRes.data, parsedResume);

  console.log('=== FINAL ATS RESULT ===');
  console.log('FINAL_ATS_SCORE:', v2Score.overallMatchPercent);
  console.log('CAPABILITY_SCORE:', v2Score.capabilityScore);
  console.log('QUALITY_SCORE:', v2Score.qualityScore);
  console.log('BAND:', v2Score.band);

  console.log('=== REQUIREMENT EVIDENCE MATRIX ===');
  v2EvalRes.data.capabilityMatrix.forEach(req => {
    console.log(`Requirement: ${req.capabilityName} (${req.type})`);
    console.log(`  Evidence Strength: ${req.evidenceStrength}`);
    console.log(`  Evidence Source: ${req.matchedContext.join(' | ')}`);
    console.log(`  Contribution: ${req.scoreContribution}`);
  });

  console.log('=== PROJECT EVIDENCE ===');
  parsedResume.projects.forEach(p => {
    console.log(`Project: ${p.name}`);
    console.log(`  Tech Preserved: ${p.technologies}`);
    // Check if it got derived in capability matrix
    const derivedCaps = v2EvalRes.data.capabilityMatrix.filter(c => c.matchedContext.some(m => m.includes(p.name)));
    console.log(`  Derived Caps: ${derivedCaps.map(c => c.capabilityName).join(', ')}`);
  });
}

run().catch(console.error);
