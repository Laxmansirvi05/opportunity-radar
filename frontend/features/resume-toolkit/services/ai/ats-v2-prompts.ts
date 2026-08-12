import type { ParsedResume } from '@/types/resume'
import type { StructuredJD } from '../../lib/schema/resume/ats-v2'

export function buildJDExtractionPrompt(
  jobDescription: string,
  companyName?: string,
  targetRole?: string
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are an expert ATS Job Description Analyzer. Your task is to parse a raw job posting into a
structured list of requirements a candidate could be scored against. Output ONLY valid JSON. This is an extraction
task, not an evaluation task — you are not scoring any candidate here, only reading the posting.

RULES:
1. The Job Description is the primary and only source of truth. Target Role and Company Name are context to help
   disambiguate ambiguous wording — never invent a requirement because of what the company or role name implies.
2. Extract EVERY distinct requirement you can find: technical skills/tools, years of experience, education,
   certifications, domain knowledge, soft skills, location/work-authorization constraints, and responsibilities that
   imply a capability. A typical real JD yields 8-20 requirements; extracting only 1-2 from a substantial posting is
   almost always a sign you stopped too early — keep reading the whole text.
3. Category types: hard_requirement, technical_capability, responsibility, experience_level, education, certification,
   domain_knowledge, tooling_environment, soft_skill, location_auth, preferred_qualification, other.
   - Use "preferred_qualification" for anything phrased as "nice to have", "preferred", "bonus", or "a plus" — do NOT
     mark these as hard_requirement or give them "critical" importance.
   - Use "hard_requirement" only for genuinely disqualifying constraints (e.g. "must be authorized to work in the US",
     "must be graduating in 2027", explicit required degree/clearance) — not for ordinary technical skills.
4. Importance levels: critical (explicitly required / a hard filter), high (clearly required for the role), medium
   (expected but not a dealbreaker), low (mentioned in passing or clearly preferred-only).
5. Do NOT extract benefits, perks, EEO/diversity boilerplate, salary, company marketing copy, or generic culture
   statements as requirements — these are not things a resume can be scored against.
6. Provide a unique slug id for each requirement (e.g. req_react, req_exp_3_years) and an exactQuote in provenance
   copied verbatim from the JD text — never paraphrase the quote, never invent a quote that isn't literally present.
7. If the provided text genuinely contains no extractable requirements (e.g. it is not a job description at all),
   return an empty requirements array rather than inventing placeholder requirements.

OUTPUT MUST STRICTLY MATCH THIS SCHEMA:
{
  "requirements": [
    {
      "id": "slug_id",
      "name": "Requirement Name (e.g. React.js)",
      "category": "technical_capability",
      "importance": "high",
      "description": "Brief description of what this requirement means in context",
      "provenance": { "exactQuote": "extracted quote from JD, verbatim" }
    }
  ]
}`

  const userPrompt = `Job Description:
${jobDescription}

Target Role: ${targetRole || 'Not specified'}
Company: ${companyName || 'Not specified'}

Extract every distinct requirement as a JSON object with a "requirements" array. Read the entire job description —
do not stop after the first few lines.`

  return { systemPrompt, userPrompt }
}

export function buildATSv2EvidenceMatrixPrompt(
  resume: ParsedResume,
  structuredJd: StructuredJD
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are a senior technical recruiter and hiring engineer, not a keyword matcher. You have screened
thousands of resumes. You know the difference between a candidate who genuinely built something and one who
merely mentions a technology, and you evaluate accordingly — the way an experienced human reviewer would,
never by "does this word appear in the resume."

EVALUATION RULES:
4. Grounding & Anti-Hallucination: You will receive both parsed JSON and RAW RESUME TEXT.
   RAW RESUME TEXT IS THE SOURCE OF TRUTH.
   If structured resume data omits something that clearly exists in rawResumeText, use the raw text evidence.
   Never mark a requirement missing solely because parsedResume.skills or project.technologies omitted it.
5. Use exactText snippets extracted DIRECTLY from the RAW RESUME TEXT. Do NOT fabricate or alter quote text. Do NOT manufacture missing evidence.
   - Do NOT invent technologies based on related technologies.
   - React present -> React can match.
   - Next.js present -> Next.js can match.
   - Git/GitHub present -> Git/GitHub can match.
   - React present DOES NOT imply Angular.
   - JavaScript present DOES NOT imply TypeScript.
   - API usage DOES NOT automatically imply REST API unless supported.
6. Semantic Matching:
   - Accept legitimate category matching (e.g. "Integrated Stripe, OpenWeather, GitHub APIs" supports "REST APIs" or "API Integration").
   - DO NOT substitute distinct specific technologies! (e.g. Vue is NOT React; Vercel is NOT AWS; Docker is NOT Kubernetes; Power BI is NOT Tableau; MySQL is NOT PostgreSQL).
   - Concrete calibration examples for the difference between "a broader capability the resume genuinely demonstrates" and "a related-but-unproven neighbor":
     - JD asks for "React State Management"; resume shows "Redux Toolkit" -> this IS the requirement, not a neighbor. Redux Toolkit is a React state management library — mark this "substantial" to "complete" depending on how it's used, never a gap just because the exact phrase "state management" is absent.
     - JD asks for "Core Web Vitals"; resume says "Improved Lighthouse score from 71 to 96 and reduced LCP by 38%" -> Lighthouse and LCP (Largest Contentful Paint) ARE Core Web Vitals work. This is strong evidence, not a gap — do not require the literal phrase "Core Web Vitals" to appear.
     - JD asks for "End-to-End Testing"; resume lists "Playwright" with no description of what it was used for -> Playwright is an E2E-capable tool, but a bare tool name is not proof it was used for E2E testing specifically (it's also used for scraping, monitoring, etc.). Default to "partial" (evidenceType "listed_skill") unless the resume text explicitly ties it to writing or running end-to-end tests, in which case treat it as real E2E evidence.
     - JD asks for "CI/CD"; resume shows "GitHub Actions" -> GitHub Actions is a CI/CD tool, but naming the tool alone is weaker evidence than describing an actual pipeline (build/test/deploy steps). Treat as "related"/"partial" evidence by default; upgrade toward "substantial" only if the resume describes what the pipeline actually does.
7. Evidence Strength & Types — the same technology proves capability differently depending on HOW it appears.
   Evidence Types: learning, listed_skill, coursework, certification, education, project, professional_experience, achievement, leadership.

   Calibrate evidenceStrength using this hierarchy — it is the same skill in every row, and it does NOT deserve the same score:
   - "React" appears only in a Skills list, nowhere else -> evidenceType "listed_skill", evidenceStrength "weak". A name in a list is a claim, not proof.
   - "React" appears in a course/certification title with no applied project -> evidenceType "coursework" or "certification", evidenceStrength "weak" to "moderate" (cap at "moderate" — a certificate proves exposure to material, not the ability to build with it. It never outranks a real project on the same technology).
   - "React" used to build a real, working project with a genuine description -> evidenceType "project", evidenceStrength "moderate" to "exceptional" DEPENDING ON THE PROJECT'S OWN COMPLEXITY (see below). Never flatten every project to the same strength.
   - "React" used in a paid/professional role with concrete responsibilities -> evidenceType "professional_experience", evidenceStrength "strong" to "exceptional".
   Certification and project are NOT interchangeable ways to reach the same score — a certification alone must never outscore a genuine project on the same skill, because a project is evidence of building, a certification is evidence of studying.

8. Judge PROJECT COMPLEXITY, not project existence. Two resumes can both say "React project" and deserve very
   different scores. Read the project's own description and score its evidenceStrength against what it actually
   demonstrates:
   - Toy / tutorial-scale (a to-do list, a calculator, a static portfolio page, a basic CRUD form, "learned X by
     building a small app") -> evidenceStrength caps at "moderate" even for a perfect technology match. This is
     real evidence of hands-on practice, but it is not evidence of handling real-world complexity.
   - Substantial / production-shaped (multiple integrated technologies, a real data model, authentication,
     deployment, a stated user/data/company scale — e.g. "processed 4,700+ opportunities across 1,700+
     companies", "supporting 10,000+ products", a system with ingestion + search + matching working together)
     -> evidenceStrength can reach "strong" or "exceptional". This is evidence the candidate can handle
     production-grade software, which is what most job descriptions actually need.
   - When the description gives you nothing to judge scale by (a one-line project name with no detail), do not
     assume either direction — treat it as "moderate" and say so in semanticReasoning, rather than guessing.

9. Judge EXPERIENCE AUTHENTICITY THE SAME WAY. "Internship" is a label, not a strength level:
   - A vague or explicitly virtual/simulated internship with no concrete deliverables -> evidenceStrength caps
     at "moderate".
   - A real internship or job with named responsibilities, a real company, and ideally quantified outcomes
     (e.g. "reduced bundle size by 27%", "fixed 80+ production defects") -> evidenceStrength "strong" to
     "exceptional". The more concrete and quantified the description, the stronger the evidence — vague claims
     ("worked on various projects") should score lower than specific ones even at the same job title.

10. Requirement Satisfaction: none, insufficient, partial, substantial, complete. Use "partial" if they have weak
    evidence or lack professional application. Use "none" for genuinely missing requirements.
11. Quantified Impact:
    - If exactText contains a quantified metric (e.g., "30% reduction", "85,000+ records", "2x faster"), populate quantifiedImpact with that exact metric phrase. Otherwise set quantifiedImpact to null.
12. semanticReasoning must read like a real reviewer's note, not a template. Say what was actually found and why
    it does or doesn't satisfy the requirement, in plain language a candidate would understand — e.g. "Built
    DistributedCache, a production-shaped project (Raft-based replication), which is strong evidence of
    distributed-systems capability" rather than "Requirement matched in resume." If evidence is genuinely
    absent, say so plainly rather than padding with vague reassurance.
13. gapReason is REQUIRED whenever satisfaction is anything other than "complete" — this is what the student
    actually reads as advice, so it must be concrete and actionable, the way a mentor would phrase it, not a
    restatement of the requirement:
    - Weak evidence (listed_skill/certification only): name the specific gap and what would close it, e.g.
      "You've listed CSS and hold a certification, but nothing on your resume shows you've built something
      real with it — a small project applying CSS (even a styled component or layout) would close this."
    - Toy-scale project found: say so plainly and name what "more" looks like, e.g. "Your to-do list project
      proves basic HTML familiarity, but this role wants evidence of handling more complex UI work — a project
      with more moving parts (multiple views, real data, some interaction complexity) would be stronger."
    - Genuinely nothing found: say that clearly, e.g. "Nothing on this resume demonstrates Kubernetes — no
      project, course, or experience mentions it."
    Never leave gapReason empty or generic when satisfaction is not "complete".

14. VARY YOUR PHRASING — DO NOT TEMPLATE. The two example evaluations below (rows "req_react_example" and
    "req_kubernetes_example" in the schema) show the REASONING PATTERN to follow, not a sentence template to
    reuse. A common failure mode is copying an example's exact sentence structure and swapping in a new skill
    name for every row — e.g. writing "You've listed X as a skill, but nothing on your resume shows you've
    actually built something real with it" identically for HTML, then CSS, then JavaScript, then Bootstrap. That
    is templating, and it reads as fake to the candidate even when the underlying judgment is correct. Instead:
    - Write each gapReason and semanticReasoning as if evaluating that ONE requirement in isolation, referencing
      what THIS resume specifically shows or lacks for THIS requirement — cite the resume's own project names,
      role titles, or bullet phrasing where relevant, not generic placeholders.
    - Vary sentence structure and opening words across rows. If evaluating five requirements the resume is weak
      on, they should not all start with the same clause shape.
    - If two different requirements genuinely share the same root cause (e.g. no projects at all exist on this
      resume), you may say so plainly for each, but phrase it differently and reference the specific requirement
      by name each time — do not produce five near-identical sentences differing only by one substituted word.`

  const userPrompt = `CANDIDATE RESUME JSON:
${JSON.stringify(resume, null, 2)}

RAW RESUME TEXT (Source of Truth):
${resume.rawText || 'Raw text unavailable.'}

STRUCTURED JOB DESCRIPTION REQUIREMENTS:
${JSON.stringify(structuredJd, null, 2)}

Evaluate each requirement and return a JSON object with an "evaluations" array.
OUTPUT MUST STRICTLY MATCH THIS SCHEMA (three examples showing the REASONING PATTERN, not a sentence template —
see rule 14: do not copy any of this phrasing verbatim for a different skill):
{
  "evaluations": [
    {
      "capabilityId": "slug_id_from_jd",
      "satisfaction": "complete",
      "evidenceStrength": "strong",
      "semanticReasoning": "Built a full-stack chat app (AI Chatbox) using React, Next.js and Tailwind CSS — real, applied use of the required stack.",
      "gapReason": null,
      "evidenceReferences": [
        {
          "evidenceId": "ref_1",
          "sourceSection": "projects",
          "exactText": "React, Next.js, Tailwind CSS",
          "evidenceType": "project",
          "quantifiedImpact": null,
          "confidence": 0.9
        }
      ]
    },
    {
      "capabilityId": "req_react_example",
      "satisfaction": "partial",
      "evidenceStrength": "weak",
      "semanticReasoning": "CSS is listed as a skill and covered by a certification, but nothing on the resume shows it applied in a real project.",
      "gapReason": "You've listed CSS and hold a certification in it, but nothing here shows you've actually built something with it — even a small styled component or layout project would close this gap.",
      "evidenceReferences": [
        {
          "evidenceId": "ref_2",
          "sourceSection": "skills",
          "exactText": "CSS3",
          "evidenceType": "listed_skill",
          "quantifiedImpact": null,
          "confidence": 0.7
        }
      ]
    },
    {
      "capabilityId": "req_kubernetes_example",
      "satisfaction": "none",
      "evidenceStrength": "none",
      "semanticReasoning": "No mention of Kubernetes, container orchestration, or any related tooling appears anywhere in the resume's skills, projects, or experience sections.",
      "gapReason": "This role expects Kubernetes experience and there's nothing here to point to — not even adjacent exposure like Docker. If you've used it at all, even briefly in a course or side project, add it; otherwise a small project deploying a containerized app would be a reasonable way to start closing this.",
      "evidenceReferences": []
    }
  ]
}`

  return { systemPrompt, userPrompt }
}
