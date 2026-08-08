import fs from "fs";
import { extractTextFromPDF } from "../lib/resume-parser/pdf-extractor";

async function run() {
  console.log("Extracting PDF...");
  const rawText = await extractTextFromPDF(fs.readFileSync("/Users/laxmansirvi/Downloads/laxman_resume.pdf"));
  
  console.log("Calling POST /api/resume/parse...");
  const parseRes = await fetch("http://localhost:3000/api/resume/parse", {
    method: "POST",
    body: fs.readFileSync("/Users/laxmansirvi/Downloads/laxman_resume.pdf"),
    headers: { "Content-Type": "application/pdf" }
  });
  const parsedResume = await parseRes.json();
  if (!parsedResume || parsedResume.error) {
    console.error("Parse failed:", parsedResume);
    return;
  }
  
  console.log("Calling POST /api/resume/ats-check...");
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
  
  const atsRes = await fetch("http://localhost:3000/api/resume/ats-check", {
    method: "POST",
    body: JSON.stringify({
      resume: parsedResume,
      jobDescription: jdFrontend.text,
      targetRole: jdFrontend.targetRole,
      companyName: jdFrontend.company
    }),
    headers: { "Content-Type": "application/json" }
  });
  
  const atsResult = await atsRes.json();
  console.log("ATS RESULT:", JSON.stringify(atsResult.atsV2?.score, null, 2));
}

run();
