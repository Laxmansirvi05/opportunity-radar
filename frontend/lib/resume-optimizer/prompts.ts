// ---------------------------------------------------------------------------
// Resume Optimizer Prompts (TDD-004)
// STRICT: AI may only rephrase existing content. Never fabricate.
// ---------------------------------------------------------------------------

export const OPTIMIZER_SYSTEM_PROMPT = `You are an expert resume writer helping a student improve their resume bullet points.

ABSOLUTE RULES — NEVER VIOLATE:
1. You MUST ONLY use information that is explicitly present in the ORIGINAL BULLET.
2. You MUST NOT invent numbers, percentages, company names, or achievements that are not in the original.
3. You MUST NOT add technologies or tools that are not mentioned in the original text.
4. If a TARGET SKILL can be naturally incorporated based on existing context, you may include it once.
5. Each rewrite must follow STAR format: describe the Situation/Task briefly, focus on the Action, and hint at the Result.
6. Each rewrite must be 1–2 sentences maximum.
7. Output exactly 3 alternatives, numbered 1, 2, 3.
8. Each alternative must be meaningfully different from the others.
9. Do NOT add explanations, preambles, or markdown. Output ONLY the 3 bullet alternatives.

OUTPUT FORMAT (strict):
1. [Rewrite 1]
2. [Rewrite 2]
3. [Rewrite 3]`

export function buildOptimizerUserPrompt(params: {
  originalBullet:   string
  opportunityTitle: string
  companyName:      string
  targetSkill:      string | null
}): string {
  const skillLine = params.targetSkill
    ? `TARGET SKILL TO NATURALLY INCORPORATE: ${params.targetSkill}`
    : 'TARGET SKILL: (none — improve clarity and impact only)'

  return `ORIGINAL BULLET:
"${params.originalBullet}"

TARGET OPPORTUNITY: ${params.opportunityTitle} at ${params.companyName}
${skillLine}

Generate 3 improved versions of this bullet point following the rules exactly.`
}

// ---------------------------------------------------------------------------
// Parse 3 alternatives from AI text output
// ---------------------------------------------------------------------------
export function parseAlternatives(raw: string): string[] {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const alternatives: string[] = []

  for (const line of lines) {
    // Match lines starting with "1.", "2.", "3." — with or without trailing space
    const match = line.match(/^[1-3]\.\s+(.+)/)
    if (match) {
      alternatives.push(match[1].trim())
    }
    if (alternatives.length === 3) break
  }

  return alternatives
}

// ---------------------------------------------------------------------------
// Fabrication guard: rejects generated bullets that contain numbers
// not present in the original bullet (to prevent metric invention)
// ---------------------------------------------------------------------------
export function passedFabricationGuard(original: string, generated: string): boolean {
  if (!generated || generated.split(' ').length < 8) return false

  const originalNumbers = new Set(original.match(/\d+(\.\d+)?%?x?/g) ?? [])
  const generatedNumbers = generated.match(/\d+(\.\d+)?%?x?/g) ?? []

  for (const num of generatedNumbers) {
    if (!originalNumbers.has(num)) return false
  }

  // Blocklist for common AI hallucination patterns
  const fabricationSignals = [
    'increased by',
    'reduced by',
    'improved by',
    '% improvement',
    '% increase',
    '% reduction',
  ]

  if (!originalNumbers.size) {
    for (const signal of fabricationSignals) {
      if (generated.toLowerCase().includes(signal)) return false
    }
  }

  return true
}
