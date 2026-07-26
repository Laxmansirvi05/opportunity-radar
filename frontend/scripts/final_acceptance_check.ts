import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import fs from "fs";
import { extractTextFromPDF } from "../lib/resume-parser/pdf-extractor";
import { calculateAtsV2Score, evaluateHardRequirements, calculateQualityScore } from "../lib/ats-checker/scoring-v2";
import { scoreRequirement } from "../lib/ats-checker/evidence-scoring";
import { verifyEvidence, sanitizeEvidenceMatrix } from "../features/resume-toolkit/services/ai/ats-v2-hallucination-guard";
import type { ParsedResume } from "../types/resume";
import type { StructuredJD, EvidenceMatrix, JDRequirement, RequirementEvaluation } from "../features/resume-toolkit/lib/schema/resume/ats-v2";

console.log("=== STARTING ATS V2.1 ACCEPTANCE VERIFICATION ===");

// 1. Evidence Hierarchy Verification
console.log("\n--- ITEM 4: EVIDENCE HIERARCHY VERIFICATION ---");
const reqBase: JDRequirement = {
  id: "req_react",
  name: "React.js",
  category: "technical_capability",
  importance: "high",
  description: "React experience",
  provenance: { exactQuote: "React" }
};

const evalLearning: RequirementEvaluation = {
  capabilityId: "req_react",
  satisfaction: "insufficient",
  evidenceStrength: "weak",
  evidenceReferences: [{ evidenceId: "1", sourceSection: "skills", exactText: "React tutorial", evidenceType: "learning", confidence: 0.8 }],
  confidence: 0.8,
  semanticReasoning: "Tutorial learning"
};

const evalListed: RequirementEvaluation = {
  capabilityId: "req_react",
  satisfaction: "partial",
  evidenceStrength: "moderate",
  evidenceReferences: [{ evidenceId: "2", sourceSection: "skills", exactText: "React", evidenceType: "listed_skill", confidence: 0.8 }],
  confidence: 0.8,
  semanticReasoning: "Listed skill"
};

const evalProject: RequirementEvaluation = {
  capabilityId: "req_react",
  satisfaction: "substantial",
  evidenceStrength: "strong",
  evidenceReferences: [{ evidenceId: "3", sourceSection: "projects", exactText: "Built app in React", evidenceType: "project", confidence: 0.9 }],
  confidence: 0.9,
  semanticReasoning: "Project evidence"
};

const evalPro: RequirementEvaluation = {
  capabilityId: "req_react",
  satisfaction: "complete",
  evidenceStrength: "strong",
  evidenceReferences: [{ evidenceId: "4", sourceSection: "experience", exactText: "Developed enterprise UI in React", evidenceType: "professional_experience", confidence: 0.95 }],
  confidence: 0.95,
  semanticReasoning: "Professional experience"
};

const evalQuantified: RequirementEvaluation = {
  capabilityId: "req_react",
  satisfaction: "complete",
  evidenceStrength: "exceptional",
  evidenceReferences: [{ evidenceId: "5", sourceSection: "experience", exactText: "Developed enterprise UI in React reducing render time by 40%", evidenceType: "professional_experience", quantifiedImpact: "40% render time reduction", confidence: 0.98 }],
  confidence: 0.98,
  semanticReasoning: "Quantified professional experience"
};

const scoreLearning = scoreRequirement(reqBase, evalLearning).weightedScore;
const scoreListed = scoreRequirement(reqBase, evalListed).weightedScore;
const scoreProject = scoreRequirement(reqBase, evalProject).weightedScore;
const scorePro = scoreRequirement(reqBase, evalPro).weightedScore;
const scoreQuantified = scoreRequirement(reqBase, evalQuantified).weightedScore;

console.log(`Learning Score: ${scoreLearning}`);
console.log(`Listed Score: ${scoreListed}`);
console.log(`Project Score: ${scoreProject}`);
console.log(`Professional Score: ${scorePro}`);
console.log(`Quantified Score: ${scoreQuantified}`);

const hierarchyPass = (scoreLearning < scoreListed) && (scoreListed < scoreProject) && (scoreProject < scorePro) && (scorePro < scoreQuantified);
console.log(`Evidence Hierarchy Test: ${hierarchyPass ? "PASS" : "FAIL"}`);

// 2. Anti-Hallucination & Semantic Equivalence Verification
console.log("\n--- ITEM 5 & 6: ANTI-HALLUCINATION & SEMANTIC MATCHING ---");
const testResume: ParsedResume = {
  name: "Sample Dev",
  skills: ["Vue", "Docker", "Vercel", "Power BI"],
  experience: [
    {
      company: "API Tech",
      role: "Integration Engineer",
      bullets: ["Integrated Stripe, OpenWeather and GitHub APIs into mobile dashboard."]
    }
  ]
};

const verifyVueForReact = verifyEvidence(testResume, { evidenceId: "1", sourceSection: "skills", exactText: "React.js", evidenceType: "listed_skill", confidence: 0.9 });
console.log(`Claimed React when resume has Vue -> verifyEvidence valid: ${verifyVueForReact.isValid} (Expect false)`);

const verifyStripeForApi = verifyEvidence(testResume, { evidenceId: "2", sourceSection: "experience", exactText: "Integrated Stripe, OpenWeather and GitHub APIs into mobile dashboard.", evidenceType: "professional_experience", confidence: 0.95 });
console.log(`Claimed exact quote for API integration -> verifyEvidence valid: ${verifyStripeForApi.isValid} (Expect true)`);

const antiHallucinationPass = !verifyVueForReact.isValid && verifyStripeForApi.isValid;
console.log(`Anti-Hallucination Guard Test: ${antiHallucinationPass ? "PASS" : "FAIL"}`);

// 3. Hard Requirements & UNKNOWN Verification
console.log("\n--- ITEM 8: HARD REQUIREMENTS & UNKNOWN HANDLING ---");
const structJdHardReq: StructuredJD = {
  jobTitle: "Software Engineer",
  companyName: "CloudCorp",
  roleFamily: "Engineering",
  seniority: "Junior",
  requirements: [
    { id: "h1", name: "B.S. in Computer Science", category: "hard_requirement", importance: "critical", description: "Required CS degree", provenance: { exactQuote: "B.S. in Computer Science" } },
    { id: "h2", name: "US Work Authorization", category: "hard_requirement", importance: "critical", description: "Must be authorized", provenance: { exactQuote: "Authorized to work in US" } }
  ]
};

const resumeNoDegree: ParsedResume = {
  name: "No Edu Candidate",
  skills: ["Java", "Python"]
};

const hardReqResNoEdu = evaluateHardRequirements(structJdHardReq, resumeNoDegree);
console.log(`Hard Req Result (No Edu): passed=${hardReqResNoEdu.passed}, failed=[${hardReqResNoEdu.failedRequirements.join(", ")}]`);
const hardReqPass = !hardReqResNoEdu.passed && hardReqResNoEdu.failedRequirements.includes("B.S. in Computer Science");
console.log(`Hard Requirements Test: ${hardReqPass ? "PASS" : "FAIL"}`);

// 4. Marker Manipulation Verification
console.log("\n--- ITEM 7: MARKER MANIPULATION VERIFICATION ---");
const resumeClean: ParsedResume = {
  name: "Clean Candidate",
  summary: "Frontend Developer with React expertise",
  skills: ["React", "JavaScript", "HTML", "CSS"],
  experience: [
    {
      company: "Web Corp",
      role: "Developer",
      bullets: ["Built React components and interfaces."]
    }
  ]
};

const resumeWithMarker: ParsedResume = {
  ...resumeClean,
  skills: ["React", "JavaScript", "HTML", "CSS", "Nimbus Cedar 47"],
  experience: [
    {
      company: "Web Corp",
      role: "Developer",
      bullets: ["Built React components and interfaces. Quartz Finch 82"]
    }
  ]
};

const qualityClean = calculateQualityScore(resumeClean);
const qualityMarker = calculateQualityScore(resumeWithMarker);
console.log(`Quality Score Clean: ${qualityClean.total}, Quality Score Marker: ${qualityMarker.total}, Delta: ${qualityMarker.total - qualityClean.total}`);
const markerPass = Math.abs(qualityMarker.total - qualityClean.total) === 0;
console.log(`Marker Manipulation Test: ${markerPass ? "PASS" : "FAIL"}`);

console.log("\n=== ALL DIRECT VERIFICATIONS COMPLETED ===");
