import fs from "fs";
import { extractTextFromPDF } from "../lib/resume-parser/pdf-extractor";
import { callAI } from "../lib/ai-gateway";
import { pdfParserSystemPrompt, pdfParserUserPrompt } from "../features/resume-toolkit/services/ai/prompts";
import { extractJDIntelligence, evaluateResumeEvidence } from "../features/resume-toolkit/services/ai/ats-v2-intelligence";
import { calculateAtsV2Score } from "../lib/ats-checker/scoring-v2";
import { jsonrepair } from "jsonrepair";
import { performance } from "perf_hooks";

const JDS = {
  swe: `We are looking for a Software Engineer to join our backend team. Requirements: Node.js, TypeScript, PostgreSQL, scalable APIs.`,
  data_analyst: `Data Analyst needed. Requirements: SQL, Python, Tableau, Data visualization, statistical modeling.`,
  frontend: `Frontend Developer Intern. Requirements: HTML, CSS, JavaScript, React, Next.js.`,
};

const RESUMES = [
  { name: "Daniel", path: "tests/fixtures/daniel_swe.pdf", jd: JDS.swe },
  { name: "Emily", path: "tests/fixtures/emily_data.pdf", jd: JDS.data_analyst },
  { name: "Laxman", path: "/Users/laxmansirvi/Downloads/laxman_resume.pdf", jd: JDS.frontend },
  { name: "Aarav", path: "tests/fixtures/aarav_frontend.pdf", jd: JDS.frontend },
  { name: "Laxman_Neg", path: "/Users/laxmansirvi/Downloads/laxman_resume.pdf", jd: JDS.data_analyst }
];

async function run() {
  for (const r of RESUMES) {
    if (!fs.existsSync(r.path)) {
      console.log(`${r.name} PDF not found at ${r.path}`);
      continue;
    }
    const t0 = performance.now();
    const rawText = await extractTextFromPDF(fs.readFileSync(r.path));
    const parseRes = await callAI(
      { systemPrompt: pdfParserSystemPrompt, userPrompt: `${pdfParserUserPrompt}\n\n${rawText.slice(0, 15000)}`, maxTokens: 4000, temperature: 0.1, outputFormat: "json" },
      { feature: "resume_parser", userId: "test" }
    );
    const t1 = performance.now();
    let parsedResume = JSON.parse(jsonrepair(parseRes.content));
    if (parsedResume.data) parsedResume = parsedResume.data;
    parsedResume.rawText = rawText;

    const v2JdRes = await extractJDIntelligence(r.jd, "TestCo", "Role", "test");
    const t2 = performance.now();
    
    const v2EvalRes = await evaluateResumeEvidence(parsedResume, v2JdRes.data!, "test");
    const t3 = performance.now();
    
    const v2Score = calculateAtsV2Score(v2JdRes.data!, v2EvalRes.data!, parsedResume);
    const t4 = performance.now();
    
    console.log(`\n--- ${r.name} ---`);
    console.log(`Score: ${v2Score.overallScore}`);
    console.log(`Capability: ${v2Score.capabilityScore}, Quality: ${v2Score.qualityScore}`);
    console.log(`Parsing Time: ${((t1 - t0)/1000).toFixed(2)}s`);
    console.log(`JD Time: ${((t2 - t1)/1000).toFixed(2)}s`);
    console.log(`Eval Time: ${((t3 - t2)/1000).toFixed(2)}s`);
    console.log(`Total Time: ${((t4 - t0)/1000).toFixed(2)}s`);
  }
}
run().catch(console.error);
