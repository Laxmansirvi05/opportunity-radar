import fs from "fs";
import { extractTextFromPDF } from "../lib/resume-parser/pdf-extractor";
import { buildATSv2EvidenceMatrixPrompt } from "../features/resume-toolkit/services/ai/ats-v2-prompts";

async function run() {
  const rawText = await extractTextFromPDF(fs.readFileSync("/Users/laxmansirvi/Downloads/laxman_resume.pdf"));
  const resume = { projects: [], rawText };
  const jd = { requirements: [{ id: "req_1", name: "React" }] };
  const { userPrompt } = buildATSv2EvidenceMatrixPrompt(resume as any, jd as any);
  console.log(userPrompt.substring(0, 500));
  console.log("...");
  console.log(userPrompt.substring(userPrompt.indexOf("RAW RESUME TEXT"), userPrompt.indexOf("RAW RESUME TEXT") + 200));
}
run();
