import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync } from 'fs';
import { extractTextFromPDF } from '../lib/resume-parser/pdf-extractor.js';
import { callAI } from '../lib/ai-gateway/index.js';
import { pdfParserSystemPrompt } from '../features/resume-toolkit/services/ai/prompts.js';
import { sanitizeAndParseResumeJson } from '../features/resume-toolkit/services/ai/sanitize.js';

async function verify() {
  console.log("Starting verification for Arjun Mehta...");
  const pdfPath = '/Users/laxmansirvi/Downloads/sample_frontend_developer_resume.pdf';
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
  });
  
  if (!aiResult.success) {
    console.error("AI call failed:", aiResult.reason);
    return;
  }
  
  const { data: finalData } = sanitizeAndParseResumeJson(aiResult.content);
  console.log("\n================ VERIFICATION REPORT ================\n");
  
  const check = (name: string, condition: boolean, details: string = "") => {
    console.log(`${name.padEnd(35)} ${condition ? '✅ PASS' : '❌ FAIL'} ${details ? `(${details})` : ''}`);
  };

  check("Name", finalData.basics.name.toLowerCase().includes('arjun mehta'), finalData.basics.name);
  check("Location", finalData.basics.location.includes("Bengaluru"), finalData.basics.location);
  check("Title", finalData.basics.headline?.toLowerCase().includes("frontend developer"), finalData.basics.headline);

  const linksFound = finalData.basics.customFields?.length > 0 || (finalData.basics.website?.url && finalData.basics.website?.url?.length > 0);
  check("Social URLs Excluded", !linksFound, "Links found in customFields or website");
  
  const edu = finalData.sections.education.items as any[];
  const iiitb = edu.find((e) => e.school?.includes("Institute of Information Technology") || e.school?.includes("IIIT"));
  check("Education -> CGPA 9.1/10", iiitb?.grade?.includes("9.1") || iiitb?.score?.includes("9.1"), iiitb?.grade || iiitb?.score || "Not found");
  
  const exp = finalData.sections.experience.items as any[];
  const novatech = exp.find((e) => e.company?.includes("NovaTech"));
  check("NovaTech Dates", novatech?.period?.includes("May 2026") && novatech?.period?.includes("Jul 2026"), novatech?.period || "Not found");
  check("NovaTech 28%", novatech?.description?.includes("28%"), "28% found in bullets");

  const codesphere = exp.find((e) => e.company?.includes("CodeSphere"));
  check("CodeSphere Dates", codesphere?.period?.includes("Dec 2025") && codesphere?.period?.includes("Feb 2026"), codesphere?.period || "Not found");
  check("CodeSphere 15+", codesphere?.description?.includes("15+"), "15+ found in bullets");
  
  const proj = finalData.sections.projects.items as any[];
  const oppTracker = proj.find((e) => e.name?.includes("Opportunity Tracker"));
  check("Opportunity Tracker Project", !!oppTracker, "Found");
  const devPort = proj.find((e) => e.name?.includes("Developer Portfolio"));
  check("Developer Portfolio Project", !!devPort, "Found");

  const skills = finalData.sections.skills.items as any[];
  check("Skills Categories", skills.length > 2, `${skills.length} found`);
  
  const certs = finalData.sections.certifications.items as any[];
  const metaCert = certs.find((e) => e.title?.includes("Meta Front-End Developer Foundations"));
  check("Meta Cert", !!metaCert, "Found");
  const jsCert = certs.find((e) => e.title?.includes("JavaScript Algorithms"));
  check("JS Cert", !!jsCert, "Found");

  const awards = finalData.sections.awards.items as any[];
  const hackathon = awards.find((e) => e.title?.includes("Hackathon"));
  check("Hackathon Award", !!hackathon, "Found");
  check("Hackathon 250+", hackathon?.description?.includes("250+") || hackathon?.title?.includes("250+"), "250+ found in hackathon");
}

verify().catch(console.error);
