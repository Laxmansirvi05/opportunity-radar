import { callAI }  from '@/lib/ai-gateway'
import {
  OPTIMIZER_SYSTEM_PROMPT,
  buildOptimizerUserPrompt,
  parseAlternatives,
  passedFabricationGuard,
} from './prompts'
import type { OptimizerResponse } from './types'
import type { AIResult } from '@/types/ai'

// ---------------------------------------------------------------------------
// Optimise a single resume bullet point
// Returns 3 STAR-format alternatives; never fabricates content
// ---------------------------------------------------------------------------
export async function optimiseBullet(params: {
  originalBullet:   string
  opportunityTitle: string
  companyName:      string
  targetSkill:      string | null
  userId:           string
  opportunityId:    string
}): Promise<{ success: true; result: OptimizerResponse } | { success: false; error: string }> {
  const userPrompt = buildOptimizerUserPrompt({
    originalBullet:   params.originalBullet,
    opportunityTitle: params.opportunityTitle,
    companyName:      params.companyName,
    targetSkill:      params.targetSkill,
  })

  // First attempt
  const aiResult: AIResult = await callAI(
    {
      systemPrompt: OPTIMIZER_SYSTEM_PROMPT,
      userPrompt,
      maxTokens:   400,
      temperature: 0.4,  // Slightly higher than parser for creative variation
      outputFormat: 'text',
    },
    {
      feature:       'resume_optimizer',
      userId:        params.userId,
      opportunityId: params.opportunityId,
    }
  )

  if (!aiResult.success) {
    return { success: false, error: `Generation failed: ${aiResult.reason}. Please try again.` }
  }

  let alternatives = parseAlternatives(aiResult.content)

  // Validate all alternatives against fabrication guard
  const validated = alternatives.filter((alt) =>
    passedFabricationGuard(params.originalBullet, alt)
  )

  // If validation wiped out results, retry once
  if (validated.length === 0) {
    const retry: AIResult = await callAI(
      {
        systemPrompt: OPTIMIZER_SYSTEM_PROMPT,
        userPrompt,
        maxTokens:   400,
        temperature: 0.3,
        outputFormat: 'text',
      },
      {
        feature:       'resume_optimizer',
        userId:        params.userId,
        opportunityId: params.opportunityId,
      }
    )

    if (!retry.success) {
      return { success: false, error: 'Could not generate valid alternatives. Please try again.' }
    }

    alternatives = parseAlternatives(retry.content).filter((alt) =>
      passedFabricationGuard(params.originalBullet, alt)
    )

    if (alternatives.length === 0) {
      return {
        success: false,
        error:   'Generated alternatives did not pass quality checks. Please rephrase your bullet and try again.',
      }
    }
  } else {
    alternatives = validated
  }

  return {
    success: true,
    result: {
      alternatives: alternatives.slice(0, 3),
      provider:     aiResult.success ? aiResult.provider : 'unknown',
      latency_ms:   aiResult.latencyMs,
    },
  }
}
