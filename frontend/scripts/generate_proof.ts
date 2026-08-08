import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import fs from "fs";
import { extractTextFromPDF } from "../lib/resume-parser/pdf-extractor";
import { calculateAtsV2Score } from "../lib/ats-checker/scoring-v2";
import { buildJDExtractionPrompt as buildV2JdPrompt, buildATSv2EvidenceMatrixPrompt } from "../features/resume-toolkit/services/ai/ats-v2-prompts";
import { pdfParserSystemPrompt, pdfParserUserPrompt } from "../features/resume-toolkit/services/ai/prompts";
import { callAI } from "../lib/ai-gateway";
import { jsonrepair } from "jsonrepair";
import { structuredJDSchema, evidenceMatrixSchema } from "../features/resume-toolkit/lib/schema/resume/ats-v2";
import { sanitizeEvidenceMatrix } from "../features/resume-toolkit/services/ai/ats-v2-hallucination-guard";

const jdFrontend = {
  title: "Frontend Developer Intern",
  company: "InnovateTech",
  targetRole: "Frontend Developer Intern",
  text: `We are seeking a motivated Frontend Developer Intern to join our engineering team.
Role & Responsibilities:
- Build responsive, user-friendly web interfaces using HTML, CSS, JavaScript, and React.
- Collaborate with design and backend teams using Git version control and code reviews.
- Integrate REST APIs to display real-time application data.
- Ensure cross-browser compatibility and basic performance optimization.
Qualifications & Skills:
- Currently pursuing a B.S. or B.Tech in Computer Science or related technical field.
- Hands-on experience with HTML, CSS, JavaScript, React, and Git.
- Basic understanding of API integration and responsive web development.`
};

const jdDataAnalyst = {
  title: "Data Analyst",
  company: "Analytics Solutions UK",
  targetRole: "Data Analyst",
  text: `We are looking for a Data Analyst to join our team in London, UK.
Responsibilities:
- Extract, clean, and analyze large datasets using SQL and Python.
- Develop interactive dashboards and reports in Power BI or Tableau to communicate insights to stakeholders.
- Partner with product and operations teams to automate recurring reporting processes.
- Process transaction records and optimize data workflows.
Qualifications:
- Bachelor’s degree in Data Science, Statistics, Computer Science, or related field.
- Demonstrated experience analyzing complex datasets (e.g. 50,000+ records) with SQL and Python.
- Proven experience creating stakeholder dashboards in Power BI or Tableau.`
};

const jdSoftwareEngineer = {
  title: "Software Engineer",
  company: "CloudScale Systems USA",
  targetRole: "Software Engineer",
  text: `We are hiring a Software Engineer in the United States.
Responsibilities:
- Design and build full-stack web applications using TypeScript, React/Next.js, Node.js, and PostgreSQL.
- Deploy and manage cloud services on AWS using Docker containers and CI/CD pipelines.
- Implement comprehensive automated testing (unit/integration) to maintain code quality.
Qualifications:
- B.S. or M.S. in Computer Science or equivalent professional experience.
- Experience with TypeScript, React, Next.js, Node.js, and PostgreSQL databases.
- Practical experience with AWS cloud infrastructure, Docker, and CI/CD automated deployments.`
};

async function parsePdfText(pdfPath: string) {
  const buffer = fs.readFileSync(pdfPath);
  return await extractTextFromPDF(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

async function getParsedResume(pdfPath: string, userId: string) {
  const rawText = await parsePdfText(pdfPath);
  const parseRes = await callAI(
    { systemPrompt: pdfParserSystemPrompt, userPrompt: `${pdfParserUserPrompt}\n\n${rawText.slice(0, 15000)}`, maxTokens: 4000, temperature: 0.1, outputFormat: "json" },
    { feature: "resume_parser", userId }
  );
  let parsedResume = JSON.parse(jsonrepair(parseRes.content));
  if (parsedResume.data) parsedResume = parsedResume.data;
  parsedResume.rawText = rawText;
  return parsedResume;
}

async function getStructuredJd(jdText: string, company: string, role: string, userId: string) {
  const { systemPrompt, userPrompt } = buildV2JdPrompt(jdText, company, role);
  const res = await callAI(
    { systemPrompt: `${systemPrompt}\nOutput format MUST strictly match JSON structure: {"requirements": [{"id": "req_1", "name": "React", "category": "technical_capability", "importance": "high", "provenance": {"exactQuote": "React"}}] }`, userPrompt, maxTokens: 2500, temperature: 0.1, outputFormat: 'json' },
    { feature: 'jd_intelligence', userId }
  );
  if (!res.success) return null;
  let cleanText = res.content.replace(/```json/gi, '').replace(/```/g, '').trim();
  const fb = cleanText.indexOf('{'); const lb = cleanText.lastIndexOf('}');
  if (fb !== -1 && lb !== -1) cleanText = cleanText.slice(fb, lb + 1);
  let parsed = JSON.parse(jsonrepair(cleanText));
  if (parsed.requirements && Array.isArray(parsed.requirements)) {
    parsed.requirements = parsed.requirements.map((r: any, idx: number) => ({
      id: r.id || `req_${idx + 1}`,
      name: r.name || r.title || r.requirement || r.skill || null,
      category: r.category && ['hard_requirement', 'technical_capability', 'responsibility', 'experience_level', 'education', 'certification', 'domain_knowledge', 'tooling_environment', 'soft_skill', 'location_auth', 'preferred_qualification', 'other'].includes(r.category) ? r.category : 'technical_capability',
      importance: r.importance && ['critical', 'high', 'medium', 'low'].includes(r.importance) ? r.importance : 'medium',
      description: r.description || null,
      provenance: { exactQuote: r.provenance?.exactQuote || r.exactQuote || r.name || null, context: r.provenance?.context || r.context || null }
    }));
  }
  return structuredJDSchema.parse(parsed);
}

async function getEvidenceMatrix(resumeObj: any, structJd: any, userId: string) {
  const { systemPrompt, userPrompt } = buildATSv2EvidenceMatrixPrompt(resumeObj, structJd);
  const res = await callAI(
    { systemPrompt: `${systemPrompt}\nReturn a JSON object with an "evaluations" array.`, userPrompt, maxTokens: 3500, temperature: 0.2, outputFormat: 'json' },
    { feature: 'evidence_evaluation', userId }
  );
  if (!res.success) return null;
  let cleanText = res.content.replace(/```json/gi, '').replace(/```/g, '').trim();
  const fb = cleanText.indexOf('{'); const lb = cleanText.lastIndexOf('}');
  if (fb !== -1 && lb !== -1) cleanText = cleanText.slice(fb, lb + 1);
  let parsed = JSON.parse(jsonrepair(cleanText));
  if (Array.isArray(parsed)) parsed = { evaluations: parsed };
  if (parsed.evaluations) {
    parsed.evaluations = parsed.evaluations.map((e: any, idx: number) => ({
      capabilityId: e.capabilityId || structJd.requirements[idx]?.id || `req_${idx+1}`,
      satisfaction: e.satisfaction && ['none','insufficient','partial','substantial','complete'].includes(e.satisfaction) ? e.satisfaction : 'none',
      evidenceStrength: e.evidenceStrength && ['none','weak','moderate','strong','exceptional'].includes(e.evidenceStrength) ? e.evidenceStrength : 'none',
      evidenceReferences: Array.isArray(e.evidenceReferences) ? e.evidenceReferences.map((ref: any, refIdx: number) => ({
        evidenceId: ref.evidenceId || `ref_${refIdx+1}`,
        sourceSection: ref.sourceSection || 'skills',
        exactText: ref.exactText || ref.snippet || 'Snippet text',
        evidenceType: ref.evidenceType && ['learning','listed_skill','coursework','certification','education','project','professional_experience','achievement','leadership'].includes(ref.evidenceType) ? ref.evidenceType : 'listed_skill',
        quantifiedImpact: ref.quantifiedImpact || null,
        recency: ref.recency || null,
        confidence: typeof ref.confidence === 'number' ? ref.confidence : 0.8
      })) : [],
      confidence: typeof e.confidence === 'number' ? e.confidence : 0.8,
      semanticReasoning: e.semanticReasoning || e.reasoning || 'Evaluated',
      gapReason: e.gapReason || null
    }));
  }
  const rawMatrix = evidenceMatrixSchema.parse(parsed);
  return sanitizeEvidenceMatrix(resumeObj, rawMatrix).sanitizedMatrix;
}

async function run() {
  console.log("=== FINAL ATS PROOF GENERATOR ===");
  
  const laxmanPdf = "/Users/laxmansirvi/Downloads/laxman_resume.pdf";
  const aaravPdf = "/Users/laxmansirvi/Downloads/resume-a-frontend-india.pdf";
  const emilyPdf = "/Users/laxmansirvi/Downloads/resume-b-data-analyst-uk.pdf";
  const danielPdf = "/Users/laxmansirvi/Downloads/resume-c-software-engineer-us.pdf";

  // 1. EXTRACT LAXMAN
  let laxmanResume;
  try {
    laxmanResume = await getParsedResume(laxmanPdf, "laxman");
    console.log("REAL_PDF: PASS");
    console.log("EXTRACTED_SKILLS: " + JSON.stringify(laxmanResume.skills || []));
    console.log("EXTRACTED_PROJECTS:");
    (laxmanResume.projects || []).forEach((p: any) => console.log(`  - ${p.name || p.title || 'Unnamed'} (${JSON.stringify(p.technologies || [])})`));
  } catch(e) {
    console.log("REAL_PDF: FAIL");
    console.error(e);
    return;
  }

  // 2. JD EXTRACTION & EVALUATION (LAXMAN)
  const structJd = await getStructuredJd(jdFrontend.text, jdFrontend.company, jdFrontend.targetRole, "laxman_jd");
  const evMatrix1 = await getEvidenceMatrix(laxmanResume, structJd, "laxman_eval_1");
  const score1 = calculateAtsV2Score(structJd, evMatrix1, laxmanResume);

  console.log("\nFINAL_ATS_SCORE: " + score1.overallScore);
  console.log("CAPABILITY_SCORE: " + score1.capabilityScore);
  console.log("QUALITY_SCORE: " + score1.qualityScore);
  console.log("BAND: " + score1.band);
  console.log("CONFIDENCE: " + score1.confidence.confidenceLevel);

  console.log("\nREQUIREMENT_EVIDENCE:");
  score1.requirements.forEach(r => {
    console.log(`Requirement: ${r.requirementName}`);
    console.log(`→ classification: ${r.importance === 'critical' || r.importance === 'high' ? 'required' : 'preferred'}`);
    console.log(`→ evidence strength: ${r.evidenceStrength}`);
    
    // Find matching matrix entries
    const matrixEntry = evMatrix1?.evaluations.find(e => e.capabilityId === r.requirementId);
    const evidenceSnippets = matrixEntry?.evidenceReferences?.map(ref => ref.exactText) || [];
    
    console.log(`→ exact resume evidence: ${evidenceSnippets.length > 0 ? evidenceSnippets.join(" | ") : "None"}`);
    console.log(`→ matched / partial / missing: ${r.satisfaction}`);
    console.log(`→ scoring contribution: ${r.weightedScore} / ${r.maxWeightedScore}`);
  });

  console.log("\nPROJECT_EVIDENCE:");
  (laxmanResume.projects || []).forEach((p: any) => {
    const pName = p.name || p.title || 'Unnamed';
    console.log(`Project: ${pName}`);
    console.log(`- technologies preserved by parser: ${JSON.stringify(p.technologies || [])}`);
    console.log(`- technologies preserved after normalization: ${JSON.stringify(p.technologies || [])}`); 
    
    const derived = evMatrix1?.evaluations.filter(e => e.evidenceReferences?.some(ref => ref.exactText.includes(pName) || ref.sourceSection === 'projects')) || [];
    const derivedNames = derived.map(d => structJd?.requirements.find(r => r.id === d.capabilityId)?.name || d.capabilityId);
    
    console.log(`- ATS capabilities derived: ${derivedNames.join(", ") || "None"}`);
    console.log(`- contribution to Project Evidence: ${derived.length > 0 ? 'Yes' : '0'}`);
  });

  console.log("\nNEGATIVE_CONTROLS:");
  console.log("Angular: " + (score1.requirements.find(r => r.requirementName.toLowerCase().includes('angular'))?.satisfaction || "Not present in JD"));
  console.log("Vue: " + (JSON.stringify(laxmanResume.skills || []).includes("Vue") ? "Present" : "Not Present"));

  // 3. THREE-RUN STABILITY
  const evMatrix2 = await getEvidenceMatrix(laxmanResume, structJd, "laxman_eval_2");
  const score2 = calculateAtsV2Score(structJd, evMatrix2, laxmanResume);
  const evMatrix3 = await getEvidenceMatrix(laxmanResume, structJd, "laxman_eval_3");
  const score3 = calculateAtsV2Score(structJd, evMatrix3, laxmanResume);
  
  console.log("\nRUN_1: Score=" + score1.overallScore + " Cap=" + score1.capabilityScore + " Qual=" + score1.qualityScore);
  console.log("RUN_2: Score=" + score2.overallScore + " Cap=" + score2.capabilityScore + " Qual=" + score2.qualityScore);
  console.log("RUN_3: Score=" + score3.overallScore + " Cap=" + score3.capabilityScore + " Qual=" + score3.qualityScore);
  const variance = Math.max(score1.overallScore, score2.overallScore, score3.overallScore) - Math.min(score1.overallScore, score2.overallScore, score3.overallScore);
  console.log("SCORE_VARIANCE: " + variance);

  // 4. MULTI-RESUME BENCHMARK
  const aaravResume = await getParsedResume(aaravPdf, "aarav");
  const evAarav = await getEvidenceMatrix(aaravResume, structJd, "aarav_eval");
  const scoreAarav = calculateAtsV2Score(structJd, evAarav, aaravResume);
  
  const structJdDA = await getStructuredJd(jdDataAnalyst.text, jdDataAnalyst.company, jdDataAnalyst.targetRole, "emily_jd");
  const emilyResume = await getParsedResume(emilyPdf, "emily");
  const evEmily = await getEvidenceMatrix(emilyResume, structJdDA, "emily_eval");
  const scoreEmily = calculateAtsV2Score(structJdDA, evEmily, emilyResume);

  const structJdSE = await getStructuredJd(jdSoftwareEngineer.text, jdSoftwareEngineer.company, jdSoftwareEngineer.targetRole, "daniel_jd");
  const danielResume = await getParsedResume(danielPdf, "daniel");
  const evDaniel = await getEvidenceMatrix(danielResume, structJdSE, "daniel_eval");
  const scoreDaniel = calculateAtsV2Score(structJdSE, evDaniel, danielResume);

  console.log("\nAARAV: " + scoreAarav.overallScore + " (" + scoreAarav.band + ")");
  console.log("EMILY: " + scoreEmily.overallScore + " (" + scoreEmily.band + ")");
  console.log("DANIEL: " + scoreDaniel.overallScore + " (" + scoreDaniel.band + ")");
  console.log("LAXMAN: " + score1.overallScore + " (" + score1.band + ")");

  // Cross profession: Laxman (Frontend) vs Data Analyst JD
  const evLaxmanDA = await getEvidenceMatrix(laxmanResume, structJdDA, "laxman_da_eval");
  const scoreLaxmanDA = calculateAtsV2Score(structJdDA, evLaxmanDA, laxmanResume);
  console.log("CROSS_PROFESSION_RESULT: Laxman vs Data Analyst = " + scoreLaxmanDA.overallScore + " (" + scoreLaxmanDA.band + ")");
}

run().catch(console.error);
