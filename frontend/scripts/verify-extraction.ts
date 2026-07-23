import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync } from 'fs';
import { extractTextFromPDF } from '../lib/resume-parser/pdf-extractor.js';
import { callAI } from '../lib/ai-gateway/index.js';
import { pdfParserSystemPrompt } from '../features/resume-toolkit/services/ai/prompts.js';
import { sanitizeAndParseResumeJson } from '../features/resume-toolkit/services/ai/sanitize.js';

async function verify() {
  console.log("Starting verification for sample_frontend_developer_resume.pdf...");
  const pdfPath = '/Users/laxmansirvi/Downloads/sample_frontend_developer_resume.pdf';
  
  let pdfBuffer;
  try {
    pdfBuffer = readFileSync(pdfPath);
  } catch (e) {
    console.error(`Could not read ${pdfPath}. Please ensure the file exists for this test.`);
    return;
  }

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
    console.error("\n[API QUOTA EXHAUSTED OR ERROR]");
    console.error("AI call failed:", aiResult.reason);
    console.error("Please run this verification script again when your free tier API quota resets.");
    return;
  }
  
  const { data: finalData } = sanitizeAndParseResumeJson(aiResult.content);
  console.log("\n================ VERIFICATION REPORT ================\n");
  
  const check = (name: string, condition: boolean, details: string = "") => {
    console.log(`${name.padEnd(35)} ${condition ? '✅ PASS' : '❌ FAIL'} ${details ? `(${details})` : ''}`);
  };

  // BASICS
  check("Name", finalData.basics.name.toLowerCase().includes('arjun mehta'), finalData.basics.name);
  check("Location", finalData.basics.location.includes("Bengaluru"), finalData.basics.location);
  check("Title", finalData.basics.headline?.toLowerCase().includes("frontend developer") || false, finalData.basics.headline);

  // NO SOCIAL URLs
  const linksFound = (finalData.basics.customFields && finalData.basics.customFields.length > 0) || 
                     (finalData.basics.website?.url && finalData.basics.website.url.length > 0);
  check("Social URLs Excluded", !linksFound, "Links found in customFields or website");
  
  // EDUCATION (Strict Mapping Check)
  const edu = finalData.sections.education.items as any[];
  const iiitb = edu.find((e) => e.school?.includes("Institute of Information Technology") || e.school?.includes("IIIT"));
  check("Education -> CGPA 9.1/10", iiitb?.grade?.includes("9.1") || iiitb?.score?.includes("9.1"), iiitb?.grade || iiitb?.score || "Not found");
  
  // EXPERIENCE (Strict Mapping Check)
  const exp = finalData.sections.experience.items as any[];
  const novatech = exp.find((e) => e.company?.includes("NovaTech"));
  check("NovaTech Dates", novatech?.period?.includes("2026") || false, novatech?.period || "Not found");
  check("NovaTech 28%", novatech?.description?.includes("28%") || false, "28% found in bullets");

  const codesphere = exp.find((e) => e.company?.includes("CodeSphere"));
  check("CodeSphere 15+", codesphere?.description?.includes("15+") || false, "15+ found in bullets");
  
  // PROJECTS (Strict Mapping Check)
  const proj = finalData.sections.projects.items as any[];
  const oppTracker = proj.find((e) => e.name?.includes("Opportunity Tracker"));
  check("Opportunity Tracker Project", !!oppTracker, "Found");

  // SKILLS
  const skills = finalData.sections.skills.items as any[];
  check("Skills Categories", skills.length > 2, `${skills.length} found`);
  
  // AWARDS & CERTS
  const certs = finalData.sections.certifications.items as any[];
  const metaCert = certs.find((e) => e.title?.includes("Meta Front-End"));
  check("Meta Cert", !!metaCert, "Found");

  console.log("\n======================================================\n");
}

verify().catch(console.error);
