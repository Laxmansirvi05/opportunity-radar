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

async function getParsedResume(pdfPath: string, userId: string) {
  const rawText = await extractTextFromPDF(fs.readFileSync(pdfPath));
  const parseRes = await callAI(
    { systemPrompt: pdfParserSystemPrompt, userPrompt: `${pdfParserUserPrompt}\n\n${rawText.slice(0, 15000)}`, maxTokens: 4000, temperature: 0.1, outputFormat: "json" },
    { feature: "resume_parser", userId }
  );
  let parsedResume = JSON.parse(jsonrepair(parseRes.content));
  if (parsedResume.data) parsedResume = parsedResume.data;
  parsedResume.rawText = rawText;
  return parsedResume;
}

async function run() {
  const laxmanPdf = "/Users/laxmansirvi/Downloads/laxman_resume.pdf";
  const laxmanResume = await getParsedResume(laxmanPdf, "laxman");
  
  const { systemPrompt, userPrompt } = buildV2JdPrompt(jdFrontend.text, jdFrontend.company, jdFrontend.targetRole);
  const res = await callAI({ systemPrompt, userPrompt, maxTokens: 2500, temperature: 0.1, outputFormat: 'json' }, { feature: 'jd_intelligence', userId: 'laxman_jd' });
  let cleanText = res.content.replace(/```json/gi, '').replace(/```/g, '').trim();
  const fb = cleanText.indexOf('{'); const lb = cleanText.lastIndexOf('}');
  if (fb !== -1 && lb !== -1) cleanText = cleanText.slice(fb, lb + 1);
  let parsed = JSON.parse(jsonrepair(cleanText));
  if (parsed.requirements) parsed.requirements = parsed.requirements.map((r: any, idx: number) => ({
    id: r.id || `req_${idx + 1}`, name: r.name || `Req ${idx+1}`, category: 'technical_capability', importance: 'medium', provenance: { exactQuote: r.name || null }
  }));
  const structJd = structuredJDSchema.parse(parsed);

  const { systemPrompt: sp2, userPrompt: up2 } = buildATSv2EvidenceMatrixPrompt(laxmanResume, structJd);
  const res2 = await callAI({ systemPrompt: sp2, userPrompt: up2, maxTokens: 3500, temperature: 0.2, outputFormat: 'json' }, { feature: 'evidence_evaluation', userId: 'laxman_eval_1' });
  let cleanText2 = res2.content.replace(/```json/gi, '').replace(/```/g, '').trim();
  const fb2 = cleanText2.indexOf('{'); const lb2 = cleanText2.lastIndexOf('}');
  if (fb2 !== -1 && lb2 !== -1) cleanText2 = cleanText2.slice(fb2, lb2 + 1);
  let parsed2 = JSON.parse(jsonrepair(cleanText2));
  if (Array.isArray(parsed2)) parsed2 = { evaluations: parsed2 };
  if (parsed2.evaluations) parsed2.evaluations = parsed2.evaluations.map((e: any, idx: number) => ({
    capabilityId: e.capabilityId || structJd.requirements[idx]?.id || `req_${idx+1}`,
    satisfaction: e.satisfaction || 'none', evidenceStrength: e.evidenceStrength || 'none',
    evidenceReferences: Array.isArray(e.evidenceReferences) ? e.evidenceReferences.map((ref: any, refIdx: number) => ({
      evidenceId: `ref_${refIdx+1}`, sourceSection: ref.sourceSection || 'skills', exactText: ref.exactText || 'Snippet text', evidenceType: ref.evidenceType || 'listed_skill', confidence: 0.8
    })) : [],
    confidence: 0.8, semanticReasoning: 'Eval'
  }));
  const rawMatrix = evidenceMatrixSchema.parse(parsed2);
  const evMatrix1 = sanitizeEvidenceMatrix(laxmanResume, rawMatrix).sanitizedMatrix;
  const score1 = calculateAtsV2Score(structJd, evMatrix1, laxmanResume);

  console.log("FINAL_ATS_SCORE: " + score1.overallScore);
  score1.requirements.forEach(r => {
    const matrixEntry = evMatrix1?.evaluations.find(e => e.capabilityId === r.requirementId);
    console.log(`Req: ${r.requirementName} -> satisfaction: ${r.satisfaction}, evidenceStrength: ${r.evidenceStrength}, exact: ${matrixEntry?.evidenceReferences?.map(ref => ref.exactText).join(" | ")}`);
  });
}
run();
