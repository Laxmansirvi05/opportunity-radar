import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import fs from "fs";
import { extractTextFromPDF } from "../lib/resume-parser/pdf-extractor";
import { calculateAtsV2Score } from "../lib/ats-checker/scoring-v2";
import { calculateJobMatch } from "../lib/ats-checker/job-match";
import { buildJDExtractionPrompt } from "../features/resume-toolkit/services/ai/ats-prompts";
import { buildJDExtractionPrompt as buildV2JdPrompt, buildATSv2EvidenceMatrixPrompt } from "../features/resume-toolkit/services/ai/ats-v2-prompts";
import { callAI } from "../lib/ai-gateway";
import { jsonrepair } from "jsonrepair";
import { structuredJDSchema, evidenceMatrixSchema } from "../features/resume-toolkit/lib/schema/resume/ats-v2";
import { jdExtractionSchema } from "../features/resume-toolkit/lib/schema/resume/ats-check";
import { sanitizeEvidenceMatrix } from "../features/resume-toolkit/services/ai/ats-v2-hallucination-guard";

const jdFrontend = {
  title: "Frontend Developer Intern",
  company: "InnovateTech",
  targetRole: "Frontend Developer Intern",
  text: `We are seeking a motivated Frontend Developer Intern to join our engineering team in India.

Role & Responsibilities:
- Build responsive, user-friendly web interfaces using HTML, CSS, JavaScript, and React.
- Collaborate with design and backend teams using Git version control and code reviews.
- Integrate REST APIs to display real-time application data.
- Ensure cross-browser compatibility and basic performance optimization.

Qualifications & Skills:
- Currently pursuing a B.S. or B.Tech in Computer Science or related technical field.
- Hands-on experience with HTML, CSS, JavaScript, React, and Git.
- Basic understanding of API integration and responsive web development.
- Preferred: Experience with TypeScript, Next.js, Tailwind CSS, or frontend testing tools.`
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
- Proven experience creating stakeholder dashboards in Power BI or Tableau.
- Strong communication skills to present analytical findings to non-technical stakeholders.
- Preferred: Experience automating data pipelines and quantifiable process improvements.`
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
- Optimize API performance and backend database queries.

Qualifications:
- B.S. or M.S. in Computer Science or equivalent professional experience.
- Experience with TypeScript, React, Next.js, Node.js, and PostgreSQL databases.
- Practical experience with AWS cloud infrastructure, Docker, and CI/CD automated deployments.
- Track record of API optimization and system performance improvements.`
};

async function parsePdfText(pdfPath: string) {
  const buffer = fs.readFileSync(pdfPath);
  return await extractTextFromPDF(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

async function runBenchmarkForCandidate(pdfPath: string, name: string, mainJd: any, otherJds: any[]) {
  console.log(`\n==================================================`);
  console.log(`BENCHMARKING: ${name}`);
  console.log(`==================================================`);
  
  const rawText = await parsePdfText(pdfPath);
  console.log(`Raw Text extracted (${rawText.length} chars)`);

  const { pdfParserSystemPrompt, pdfParserUserPrompt } = await import("../features/resume-toolkit/services/ai/prompts");
  const parseRes = await callAI(
    { systemPrompt: pdfParserSystemPrompt, userPrompt: `${pdfParserUserPrompt}\n\n${rawText.slice(0, 15000)}`, maxTokens: 4000, temperature: 0.1, outputFormat: "json" },
    { feature: "resume_parser", userId: "benchmark-agent" }
  );

  let parsedResume = JSON.parse(jsonrepair(parseRes.content));
  if (parsedResume.data) parsedResume = parsedResume.data;
  
  console.log(`\n--- PARSED RESUME METADATA ---`);
  console.log(`Name:`, parsedResume.name || parsedResume.basics?.name);
  console.log(`Location:`, parsedResume.location || parsedResume.basics?.location);
  console.log(`Skills:`, parsedResume.skills);
  console.log(`Experience Items:`, parsedResume.experience?.length || 0);
  console.log(`Projects Items:`, parsedResume.projects?.length || 0);

  async function getStructuredJd(jdText: string, company: string, role: string) {
    const { systemPrompt, userPrompt } = buildV2JdPrompt(jdText, company, role);
    const res = await callAI(
      { systemPrompt: `${systemPrompt}\nOutput format MUST strictly match JSON structure: {"requirements": [{"id": "req_1", "name": "React", "category": "technical_capability", "importance": "high", "provenance": {"exactQuote": "React"}}] }`, userPrompt, maxTokens: 2500, temperature: 0.1, outputFormat: 'json' },
      { feature: 'jd_intelligence', userId: 'benchmark' }
    );
    if (!res.success) return null;
    let cleanText = res.content.replace(/```json/gi, '').replace(/```/g, '').trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanText = cleanText.slice(firstBrace, lastBrace + 1);
    }
    let parsed = JSON.parse(jsonrepair(cleanText));
    if (parsed.requirements && Array.isArray(parsed.requirements)) {
      parsed.requirements = parsed.requirements.map((r: any, idx: number) => ({
        id: r.id || `req_${idx + 1}`,
        name: r.name || r.title || r.requirement || `Requirement ${idx + 1}`,
        category: r.category && ['hard_requirement', 'technical_capability', 'responsibility', 'experience_level', 'education', 'certification', 'domain_knowledge', 'tooling_environment', 'soft_skill', 'location_auth', 'preferred_qualification', 'other'].includes(r.category) ? r.category : 'technical_capability',
        importance: r.importance && ['critical', 'high', 'medium', 'low'].includes(r.importance) ? r.importance : 'medium',
        description: r.description || null,
        provenance: {
          exactQuote: r.provenance?.exactQuote || r.exactQuote || r.name || null,
          context: r.provenance?.context || r.context || null
        }
      }));
    }
    return structuredJDSchema.parse(parsed);
  }

  async function getEvidenceMatrix(resumeObj: any, structJd: any) {
    const { systemPrompt, userPrompt } = buildATSv2EvidenceMatrixPrompt(resumeObj, structJd);
    const res = await callAI(
      { systemPrompt: `${systemPrompt}\nReturn a JSON object with an "evaluations" array. Each item MUST have capabilityId matching a requirement id, satisfaction (none|insufficient|partial|substantial|complete), evidenceStrength (none|weak|moderate|strong|exceptional), evidenceReferences (array of {evidenceId, sourceSection, exactText, evidenceType, confidence}), confidence (0 to 1), semanticReasoning (string).`, userPrompt, maxTokens: 3500, temperature: 0.2, outputFormat: 'json' },
      { feature: 'evidence_evaluation', userId: 'benchmark' }
    );
    if (!res.success) return null;
    let cleanText = res.content.replace(/```json/gi, '').replace(/```/g, '').trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanText = cleanText.slice(firstBrace, lastBrace + 1);
    }
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
        semanticReasoning: e.semanticReasoning || e.reasoning || 'Evaluated candidate evidence.',
        gapReason: e.gapReason || null
      }));
    }
    const rawMatrix = evidenceMatrixSchema.parse(parsed);
    return sanitizeEvidenceMatrix(resumeObj, rawMatrix).sanitizedMatrix;
  }

  // 1. Run ATS V2 Pipeline on Main Target JD
  console.log(`\n--- TARGET ROLE ANALYSIS (${mainJd.title}) ---`);
  const structJd = await getStructuredJd(mainJd.text, mainJd.company, mainJd.targetRole);
  if (!structJd) {
    console.error("Failed Struct JD");
    return;
  }

  const evMatrix = await getEvidenceMatrix(parsedResume, structJd);
  if (!evMatrix) {
    console.error("Failed Ev Matrix");
    return;
  }

  const v2Score = calculateAtsV2Score(structJd, evMatrix, parsedResume);
  console.log(`\n>>> ATS V2 OVERALL SCORE: ${v2Score.overallScore} / 100 <<<`);
  console.log(`Capability Score: ${v2Score.capabilityScore}, Quality Score: ${v2Score.qualityScore}, Band: ${v2Score.band}`);
  console.log(`Confidence: ${v2Score.confidence.confidenceLevel} (${v2Score.confidence.evaluationCoverage * 100}% coverage)`);
  console.log(`Hard Requirements:`, v2Score.hardRequirements);

  console.log("\nRequirement Evaluations Table:");
  v2Score.requirements.forEach(r => {
    console.log(`  - [${r.importance}] ${r.requirementName}: ${r.satisfaction} (${r.evidenceStrength}, bestType: ${r.bestEvidenceType}, impact: ${r.hasQuantifiedImpact}, score: ${r.weightedScore}/${r.maxWeightedScore})`);
    if (r.gapReason) console.log(`      Gap: ${r.gapReason}`);
  });

  try {
    const { systemPrompt: jdSys, userPrompt: jdUser } = buildJDExtractionPrompt(mainJd.text, mainJd.company, mainJd.targetRole);
    const jdAiRes = await callAI({ systemPrompt: jdSys, userPrompt: jdUser, maxTokens: 2000, temperature: 0.1, outputFormat: "json" }, { feature: "resume_ats_jd_extract", userId: "benchmark" });
    if (jdAiRes.success) {
      let cleanJdText = jdAiRes.content.replace(/```json/gi, '').replace(/```/g, '').trim();
      const fb = cleanJdText.indexOf('{');
      const lb = cleanJdText.lastIndexOf('}');
      if (fb !== -1 && lb !== -1) cleanJdText = cleanJdText.slice(fb, lb + 1);
      let rawParsed = JSON.parse(jsonrepair(cleanJdText));
      if (Array.isArray(rawParsed)) {
        rawParsed = { title: mainJd.title, targetRole: mainJd.targetRole, requiredSkills: rawParsed.map((s: any) => typeof s === 'string' ? s : s.name || s.skill || String(s)) };
      }
      const parsedJd = jdExtractionSchema.parse(rawParsed);
      const v3Score = calculateJobMatch(parsedResume, parsedJd);
      console.log(`\nLEGACY V3 SCORE: ${v3Score.score} / 100 (Keyword Coverage score: ${v3Score.categories.keywordCoverage.score}/${v3Score.categories.keywordCoverage.maxScore})`);
    }
  } catch (err: any) {
    console.log(`\nLEGACY V3 SCORE: [Skipped due to LLM structure variation: ${err.message}]`);
  }

  // 2. Marker Manipulation Test
  console.log(`\n--- MARKER MANIPULATION TEST ---`);
  const textWithoutMarker = rawText.replace(/Nimbus Cedar \d+|Quartz Finch \d+|Aurora Maple \d+/gi, "Standard Reference");
  const parseResNoMarker = await callAI(
    { systemPrompt: pdfParserSystemPrompt, userPrompt: `${pdfParserUserPrompt}\n\n${textWithoutMarker.slice(0, 15000)}`, maxTokens: 4000, temperature: 0.1, outputFormat: "json" },
    { feature: "resume_parser", userId: "benchmark-agent" }
  );
  let parsedNoMarker = JSON.parse(jsonrepair(parseResNoMarker.content));
  if (parsedNoMarker.data) parsedNoMarker = parsedNoMarker.data;
  
  const evMatrixNoMarker = await getEvidenceMatrix(parsedNoMarker, structJd);
  const v2ScoreNoMarker = calculateAtsV2Score(structJd, evMatrixNoMarker!, parsedNoMarker);
  console.log(`Score WITH marker: ${v2Score.overallScore}`);
  console.log(`Score WITHOUT marker: ${v2ScoreNoMarker.overallScore}`);
  console.log(`MARKER DELTA: ${v2Score.overallScore - v2ScoreNoMarker.overallScore}`);

  // 3. Cross-Profession Sanity Tests
  console.log(`\n--- CROSS-PROFESSION SANITY TESTS ---`);
  for (const altJd of otherJds) {
    const altStructJd = await getStructuredJd(altJd.text, altJd.company, altJd.targetRole);
    if (altStructJd) {
      const altEvMatrix = await getEvidenceMatrix(parsedResume, altStructJd);
      if (altEvMatrix) {
        const altScore = calculateAtsV2Score(altStructJd, altEvMatrix, parsedResume);
        console.log(`Score vs ${altJd.title}: ${altScore.overallScore} / 100 (Capability: ${altScore.capabilityScore})`);
      }
    }
  }
}

async function runBenchmark() {
  await runBenchmarkForCandidate("/Users/laxmansirvi/Downloads/resume-a-frontend-india.pdf", "AARAV MEHTA", jdFrontend, [jdDataAnalyst, jdSoftwareEngineer]);
  await runBenchmarkForCandidate("/Users/laxmansirvi/Downloads/resume-b-data-analyst-uk.pdf", "EMILY CARTER", jdDataAnalyst, [jdFrontend, jdSoftwareEngineer]);
  await runBenchmarkForCandidate("/Users/laxmansirvi/Downloads/resume-c-software-engineer-us.pdf", "DANIEL KIM", jdSoftwareEngineer, [jdFrontend, jdDataAnalyst]);
}

runBenchmark();
