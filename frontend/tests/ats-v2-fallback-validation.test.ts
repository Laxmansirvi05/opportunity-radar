import { describe, it, expect, vi } from 'vitest'
import { normalizeStructuredJd, normalizeEvidenceMatrix } from '../features/resume-toolkit/services/ai/ats-v2-intelligence'
import { callAI } from '../lib/ai-gateway'

vi.mock('../lib/ai-gateway/providers/gemini', () => ({
  callGemini: vi.fn().mockImplementation(async () => ({
    success: true,
    content: '{"invalid_schema": true, "requirements": "not an array"}',
    provider: 'gemini',
    latencyMs: 100,
  })),
}))

vi.mock('../lib/ai-gateway/providers/openrouter', () => ({
  callOpenRouter: vi.fn().mockImplementation(async () => ({
    success: true,
    content: JSON.stringify({
      requirements: [
        {
          id: 'req_1',
          name: 'React.js',
          category: 'technical_capability',
          importance: 'high',
          provenance: { exactQuote: 'React' },
        },
      ],
    }),
    provider: 'openrouter',
    latencyMs: 120,
  })),
}))

describe('ATS V2 Schema Validation & Provider Fallback', () => {
  it('normalizes raw AI output with missing minor fields into valid StructuredJD schema', () => {
    const rawJd = {
      requirements: [
        {
          name: 'TypeScript',
          category: 'technical_capability',
          importance: 'high',
          exactQuote: 'TypeScript',
        },
      ],
    }
    const normalized = normalizeStructuredJd(rawJd)
    expect(normalized.requirements).toHaveLength(1)
    expect(normalized.requirements[0].id).toBe('req_1')
    expect(normalized.requirements[0].provenance.exactQuote).toBe('TypeScript')
  })

  it('normalizes raw AI evidence matrix array into valid EvidenceMatrix schema', () => {
    const rawEvaluations = [
      {
        capabilityId: 'req_1',
        satisfaction: 'complete',
        evidenceStrength: 'strong',
        evidenceReferences: [
          {
            exactText: 'Built apps using React',
            evidenceType: 'project',
          },
        ],
        semanticReasoning: 'Strong project evidence',
      },
    ]
    const normalized = normalizeEvidenceMatrix(rawEvaluations)
    expect(normalized.evaluations).toHaveLength(1)
    expect(normalized.evaluations[0].evidenceReferences[0].evidenceType).toBe('project')
    expect(normalized.evaluations[0].evidenceReferences[0].confidence).toBe(0.8)
  })

  it('triggers provider fallback when a provider returns schema-invalid response', async () => {
    const validator = (content: string, provider?: string) => {
      if (provider === 'gemini') {
        return { valid: false as const, reason: 'Simulated gemini schema failure' }
      }
      try {
        const parsed = JSON.parse(content)
        return { valid: true as const }
      } catch (e: any) {
        return { valid: false as const, reason: e.message }
      }
    }

    const result = await callAI(
      {
        systemPrompt: 'test',
        userPrompt: 'test',
        maxTokens: 500,
        temperature: 0.1,
        outputFormat: 'json',
      },
      {
        feature: 'jd_intelligence',
        userId: 'test-user',
        validator,
      }
    )

    expect(result.success).toBe(true)
    expect(result.provider).toBe('openrouter')
  })
})
