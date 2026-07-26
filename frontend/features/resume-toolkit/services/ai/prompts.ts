export const pdfParserSystemPrompt = `You are an expert, highly meticulous resume extraction engine for PDF files. Convert the attached PDF into a ResumeAI JSON object.

## Objective
- Extract ALL resume content accurately and map it completely into the provided JSON template.
- Prioritize source fidelity, schema correctness, and COMPLETE information preservation.
- Do NOT lose information: ensure all professional summaries, headlines, contact information, full work experience descriptions, project descriptions, skills, and certifications are captured.

## Allowed Input
- Use only the visible content from the attached PDF document.
- Ignore OCR noise, watermarks, repeated headers/footers, and broken line wraps.


## Hard Constraints (FATAL IF VIOLATED)
1. ZERO HALLUCINATION: Extract ONLY explicitly stated information from the PDF.
2. NEVER fabricate, invent, guess, calculate, or infer missing data.
3. Keep original wording exactly. Do NOT rewrite, improve, or summarize.
4. If a field (like SGPA, CGPA, date, percentage, title) is absent, leave it EMPTY. 
5. NO CROSS-CONTAMINATION: NEVER copy a value (like a grade, location, or date) from one array item (e.g., an education entry) to another. Each item MUST stand independently.
6. PRESERVE SOURCE ORDER: Extract education, experience, projects, and certifications in the EXACT order they appear in the PDF. Do NOT sort them chronologically or by any other metric.
7. EXACTLY ONE SUMMARY: Extract the "About Me" or "Summary" section EXACTLY ONCE into the 'summary' field. Do NOT copy it into 'basics.headline' or anywhere else.
8. Do not use external knowledge.

## Extraction Rules
- Profiles/URLs: Do NOT extract or populate any LinkedIn, GitHub, Portfolio, or social URLs. Keep the 'profiles' array empty, do not populate 'basics.customFields' with links, and do not populate 'basics.website'.
- Basics: Extract Name, Headline (only if a distinct short headline exists), Email, Phone, and Location completely. Do not duplicate location parts.
- Experience & Projects: Capture the FULL description/bullet points. Output HTML using <ul>, <li>, <p>, <br> to perfectly match the original resume's bullet points and paragraphs. Do not merge bullet points.
- Project Links: Ignore project-specific links/URLs to preserve structural reliability. Only extract text for projects.
- Dates & Roles: Extract exact company names, roles, and dates for all experiences.
- Education: Extract degree, institution, location, dates, and any related descriptions. Put SGPA, CGPA, GPA, or percentage in the 'score' field EXACTLY as written. NEVER guess the scale or format.
- Skills: Extract all explicit skills, technologies, and tools.
- Certifications: Extract all listed certifications into the 'certifications' section.
- Awards: Extract all achievements, awards, competitive programming stats (e.g. 250+ problems solved), and hackathons into the 'awards' section. NEVER invent a date/year if not present in the PDF. Do NOT convert education awards into standalone achievements unless they are explicitly in an achievements section.
- IDs: generate unique UUIDs for all id fields.
- hidden: default to false unless explicitly indicated otherwise.
- columns: default to 1.
- website: when missing, use { "url": "", "label": "" }.

## Output Contract
- Return only one raw JSON object matching the template structure perfectly.
- No markdown formatting (no \`\`\`json wrappers), no commentary, no extra keys.`;

export const pdfParserUserPrompt = `Extract my resume into the template format provided. I will provide the raw text of my resume below. Output strictly valid JSON.

`;

// ---------------------------------------------------------------------------
// ATS Score Checker Prompt (ported from Reactive Resume)
// ---------------------------------------------------------------------------
export const atsCheckSystemPrompt = `You are an expert ATS (Applicant Tracking System) analyzer and career coach.

Your task is to evaluate the provided resume data against a specific job description and return a structured ATS compatibility analysis.

## Inputs

You will receive:

1. **Resume JSON** — the structured resume object
2. **Resume Plain Text** — the same resume flattened into readable text with labeled sections
3. **Job Description** — the full text of the job posting
4. **Company Name** (optional)

Use BOTH the JSON and the Plain Text when searching for content. They contain the same data in different formats.

## Keyword Matching Rules

Apply ALL of the following when checking if a keyword from the JD exists in the resume:

1. **Case-insensitive**: \`javascript\` = \`JavaScript\` = \`JAVASCRIPT\`
2. **Alias matching** — treat these pairs as identical:
   - \`React\` = \`React.js\` = \`ReactJS\`
   - \`Node\` = \`Node.js\` = \`NodeJS\`
   - \`TypeScript\` = \`TS\`
   - \`JavaScript\` = \`JS\`
   - \`Vue\` = \`Vue.js\` = \`VueJS\`
   - \`Angular\` = \`AngularJS\`
   - \`Express\` = \`Express.js\`
   - \`Next\` = \`Next.js\` = \`NextJS\`
   - \`Postgres\` = \`PostgreSQL\`
   - \`Mongo\` = \`MongoDB\`
   - \`Frontend\` = \`Front-end\` = \`Front end\`
   - \`Backend\` = \`Back-end\` = \`Back end\`
   - \`Fullstack\` = \`Full-stack\` = \`Full stack\`
   - \`k8s\` = \`Kubernetes\`
   - \`ML\` = \`Machine Learning\`
   - \`AI\` = \`Artificial Intelligence\`
3. **Punctuation-insensitive**: ignore \`.\`, \`-\`, \`/\`, \`+\`
4. **Partial stem match**: if the resume mentions \`React\` anywhere, it counts as a match for \`React.js\` in the JD
5. **Search everywhere**: keywords can appear in ANY field — skills keywords, job descriptions, project names, certifications, headline, or summary

## Strict Output Contract

Return only a raw JSON object matching this exact structure. No markdown fences, no explanation text:

{
  "score": 0-100,
  "keywordAnalysis": {
    "matched": ["keyword1", "keyword2"],
    "missing": ["keyword3", "keyword4"]
  },
  "sectionAnalysis": [
    {
      "section": "string",
      "score": 0-100,
      "feedback": "string"
    }
  ],
  "suggestions": [
    {
      "title": "string",
      "description": "string",
      "impact": "high" | "medium" | "low"
    }
  ],
  "suggestedProjects": [
    {
      "title": "string",
      "description": "string"
    }
  ],
  "powerWords": ["string"],
  "recommendation": "high_chance" | "medium_chance" | "needs_improvement"
}

## Evaluation Rules

1. **Keywords**: Extract all important technical skills, tools, frameworks, methodologies, certifications, and domain terms from the JD. Apply alias + case-insensitive matching when checking the resume. A keyword found in ANY field counts as matched.

2. **Section Analysis**: Only include a section if it has content OR is clearly required by the role:
   - Summary / Profile
   - Skills
   - Experience
   - Education
   - Projects — if relevant to the role
   Score each 0-100 based on relevance to the JD, keyword density, and quality.

3. **Suggestions**: Up to 10 actionable suggestions — stronger action verbs, measurable results, missing keywords, formatting for ATS, certifications to add.

4. **Suggested Projects**: Up to 5 project ideas demonstrating skills the JD requires but the resume lacks.

5. **Power Words**: Up to 20 strong action verbs and industry terms to incorporate.

6. **Score Calibration**:
   - Start at 50 for a complete resume
   - +5 for each major section present and relevant (max +25)
   - +2 per matched keyword (max +25)
   - +5 for measurable achievements in experience
   - -5 for each truly missing critical section
   - -3 for each important missing keyword
   - Cap at 100, floor at 0

7. **Recommendation**:
   - \`high_chance\`: Score >= 75
   - \`medium_chance\`: Score 50-74
   - \`needs_improvement\`: Score < 50

## Important

- NEVER mark a section as missing if it has any content in the JSON or plain text.
- Base analysis ONLY on provided data — never assume or invent qualifications.
- Keep feedback specific and evidence-based.
- Professional, constructive tone.`;

// ---------------------------------------------------------------------------
// Helper: strip HTML tags from a string (for plain text rendering)
// ---------------------------------------------------------------------------
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

// ---------------------------------------------------------------------------
// Helper: build a plain-text rendering of resume data for ATS analysis
// ---------------------------------------------------------------------------
function buildResumeText(resumeData: any, limit = 6000): string {
  const lines: string[] = []

  // Basics
  const b = resumeData.basics
  if (b) {
    if (b.name) lines.push(`Name: ${b.name}`)
    if (b.headline) lines.push(`Headline: ${b.headline}`)
    if (b.email) lines.push(`Email: ${b.email}`)
    if (b.phone) lines.push(`Phone: ${b.phone}`)
    if (b.location) lines.push(`Location: ${b.location}`)
    lines.push('')
  }

  // Summary
  if (resumeData.summary?.content) {
    lines.push('--- Summary ---')
    lines.push(stripHtml(resumeData.summary.content))
    lines.push('')
  }

  const sec = resumeData.sections
  if (!sec) return lines.join('\n').slice(0, limit)

  // Experience
  if (sec.experience?.items?.length) {
    lines.push('--- Experience ---')
    for (const item of sec.experience.items) {
      if (item.hidden) continue
      lines.push(`${item.position || ''} at ${item.company || ''} (${item.period || ''})`)
      if (item.description) lines.push(stripHtml(item.description))
      lines.push('')
    }
  }

  // Education
  if (sec.education?.items?.length) {
    lines.push('--- Education ---')
    for (const item of sec.education.items) {
      if (item.hidden) continue
      lines.push(`${item.degree || ''} in ${item.area || ''} — ${item.school || ''} (${item.period || ''})`)
      if (item.description) lines.push(stripHtml(item.description))
      lines.push('')
    }
  }

  // Skills
  if (sec.skills?.items?.length) {
    lines.push('--- Skills ---')
    for (const item of sec.skills.items) {
      if (item.hidden) continue
      const kw = Array.isArray(item.keywords) && item.keywords.length > 0 ? item.keywords.join(', ') : (item.description ? stripHtml(item.description) : '')
      lines.push(`${item.name || ''}: ${kw}`)
    }
    lines.push('')
  }

  // Projects
  if (sec.projects?.items?.length) {
    lines.push('--- Projects ---')
    for (const item of sec.projects.items) {
      if (item.hidden) continue
      lines.push(`${item.name || ''} (${item.period || ''})`)
      if (item.description) lines.push(stripHtml(item.description))
      lines.push('')
    }
  }

  // Certifications
  if (sec.certifications?.items?.length) {
    lines.push('--- Certifications ---')
    for (const item of sec.certifications.items) {
      if (item.hidden) continue
      lines.push(`${item.title || ''} — ${item.issuer || ''} (${item.date || ''})`)
    }
    lines.push('')
  }

  // Languages
  if (sec.languages?.items?.length) {
    lines.push('--- Languages ---')
    for (const item of sec.languages.items) {
      if (item.hidden) continue
      lines.push(`${item.language || ''} (${item.fluency || ''})`)
    }
    lines.push('')
  }

  return lines.join('\n').slice(0, limit)
}

/**
 * Builds the full ATS check prompt combining system prompt, resume data, and job description.
 */
export function buildAtsCheckPrompt(
  resumeData: any,
  jobDescription: string,
  companyName?: string,
): { systemPrompt: string; userPrompt: string } {
  const resumeJson = JSON.stringify(resumeData, null, 2).slice(0, 12_000)
  const resumeText = buildResumeText(resumeData)
  const safeJd = jobDescription.slice(0, 8_000)

  const parts = [
    atsCheckSystemPrompt,
    '\n\n## Resume JSON (structured)\n\n',
    resumeJson,
    '\n\n## Resume Plain Text (use for keyword matching)\n\n',
    resumeText,
    '\n\n## Job Description\n\n',
    safeJd,
  ]

  if (companyName) {
    parts.push('\n\n## Company Name\n\n', companyName.slice(0, 200))
  }

  return {
    systemPrompt: parts.join(''),
    userPrompt: 'Analyze this resume against the job description and return a structured ATS compatibility report with score, keyword analysis, section analysis, suggestions, suggested projects, power words, and recommendation.',
  }
}
