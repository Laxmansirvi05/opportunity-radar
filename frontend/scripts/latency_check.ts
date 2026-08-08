import fs from "fs";
import { extractTextFromPDF } from "../lib/resume-parser/pdf-extractor";
import { callAI } from "../lib/ai-gateway";
import { pdfParserSystemPrompt, pdfParserUserPrompt } from "../features/resume-toolkit/services/ai/prompts";
import { extractJDIntelligence, evaluateResumeEvidence } from "../features/resume-toolkit/services/ai/ats-v2-intelligence";
import { calculateAtsV2Score } from "../lib/ats-checker/scoring-v2";
import { jsonrepair } from "jsonrepair";
import { performance } from "perf_hooks";

async function run() {
  console.log("Starting Real Pipeline Latency Check...");
  const t0 = performance.now();
  
  // 1. PDF Parsing
  const rawText = await extractTextFromPDF(fs.readFileSync("/Users/laxmansirvi/Downloads/laxman_resume.pdf"));
  const parseRes = await callAI(
    { systemPrompt: pdfParserSystemPrompt, userPrompt: `${pdfParserUserPrompt}\n\n${rawText.slice(0, 15000)}`, maxTokens: 4000, temperature: 0.1, outputFormat: "json" },
    { feature: "resume_parser", userId: "test" }
  );
  let parsedResume = JSON.parse(jsonrepair(parseRes.content));
  if (parsedResume.data) parsedResume = parsedResume.data;
  parsedResume.rawText = rawText;
  
  const t1 = performance.now();
  console.log(`PDF Parsing Time: ${((t1 - t0) / 1000).toFixed(2)}s`);

  // 2. JD Intelligence
  const jdText = `We are seeking a motivated Frontend Developer Intern to join our engineering team.
Role & Responsibilities:
- Build responsive, user-friendly web interfaces using HTML, CSS, JavaScript, and React.
- Collaborate with design and backend teams using Git version control and code reviews.
- Integrate REST APIs to display real-time application data.
- Ensure cross-browser compatibility and basic performance optimization.
Qualifications & Skills:
- Currently pursuing a B.S. or B.Tech in Computer Science or related technical field.
- Hands-on experience with HTML, CSS, JavaScript, React, and Git.
- Basic understanding of API integration and responsive web development.`;

  const v2JdRes = await extractJDIntelligence(jdText, "InnovateTech", "Frontend Developer Intern", "test");
  const t2 = performance.now();
  console.log(`JD Intelligence Time: ${((t2 - t1) / 1000).toFixed(2)}s`);

  // 3. Evidence Evaluation
  const v2EvalRes = await evaluateResumeEvidence(parsedResume, v2JdRes.data!, "test");
  const t3 = performance.now();
  console.log(`Evidence Evaluation Time: ${((t3 - t2) / 1000).toFixed(2)}s`);
  
  const v2Score = calculateAtsV2Score(v2JdRes.data!, v2EvalRes.data!, parsedResume);
  console.log(`Total ATS Request Time: ${((t3 - t0) / 1000).toFixed(2)}s`);
  console.log(`Score: ${v2Score.overallScore}`);
}

run().catch(console.error);
