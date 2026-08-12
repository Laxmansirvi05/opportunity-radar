import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/resume/ats-check/route';
import { buildATSv2EvidenceMatrixPrompt, buildJDExtractionPrompt } from '../features/resume-toolkit/services/ai/ats-v2-prompts';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({ get: vi.fn(), set: vi.fn() })
}));

// The saved-resume lookup must return a parsed resume. Returning `data: null`
// made the route answer 404 "Saved Resume not found" before reaching any ATS
// logic, so every test posting a resumeId asserted against an error body — the
// reason all five of these were failing.
const STORED_RESUME = {
  id: '123',
  parsed_data: {
    name: 'Test Candidate',
    email: 'test@example.com',
    summary: 'Frontend developer with React and TypeScript experience.',
    skills: ['React', 'TypeScript', 'JavaScript', 'HTML', 'CSS'],
    experience: [
      {
        company: 'Acme',
        role: 'Frontend Intern',
        start_date: '2024-01',
        end_date: '2024-06',
        bullets: ['Built React components used across the product.'],
      },
    ],
    education: [
      { institution: 'State University', degree: 'B.Tech', field: 'Computer Science', graduation_year: 2026, gpa: 8.2 },
    ],
    projects: [{ name: 'Portfolio', description: 'Personal site', technologies: ['React'] }],
  },
}

// Captures every `.insert(...)` call made against `resume_ats_reports` so
// tests can assert on exactly what score got persisted, not just that the
// request succeeded.
export const insertCalls: unknown[] = []

function supabaseStub() {
  const chain: Record<string, unknown> = {}
  Object.assign(chain, {
    select: () => chain,
    insert: vi.fn((payload: unknown) => {
      insertCalls.push(payload)
      return chain
    }),
    update: () => chain,
    eq: () => chain,
    single: vi.fn().mockResolvedValue({ data: STORED_RESUME, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: STORED_RESUME, error: null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
  })
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  }
}

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => supabaseStub(),
  createClient: () => supabaseStub(),
}));

const mockExtractJDIntelligence = vi.fn();
const mockEvaluateResumeEvidence = vi.fn();

vi.mock('../features/resume-toolkit/services/ai/ats-v2-intelligence', () => ({
  extractJDIntelligence: (...args: any[]) => mockExtractJDIntelligence(...args),
  evaluateResumeEvidence: (...args: any[]) => mockEvaluateResumeEvidence(...args)
}));

function createRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/resume/ats-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

describe('ATS V2 Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Prompt Generation (Tests A, B, C)', () => {
    it('TEST A & B & C: Prompts must contain raw text instructions and hallucination guardrails', () => {
      const { systemPrompt } = buildATSv2EvidenceMatrixPrompt({ rawText: 'React Git' } as any, { requirements: [] } as any);
      
      // TEST A: RawText contains React / ParsedSkills does not
      expect(systemPrompt).toContain('RAW RESUME TEXT IS THE SOURCE OF TRUTH');
      expect(systemPrompt).toContain('If structured resume data omits something that clearly exists in rawResumeText, use the raw text evidence.');
      expect(systemPrompt).toContain('Never mark a requirement missing solely because parsedResume.skills or project.technologies omitted it.');
      
      // TEST B: RawText contains Git/GitHub
      expect(systemPrompt).toContain('Git/GitHub present -> Git/GitHub can match');
      
      // TEST C: React does not imply Angular
      expect(systemPrompt).toContain('React present -> React can match.');
      expect(systemPrompt).toContain('React present DOES NOT imply Angular.');
      expect(systemPrompt).toContain('JavaScript present DOES NOT imply TypeScript.');
    });
  });

  describe('Semantic matching calibration examples', () => {
    // These assert the prompt teaches the exact calibration patterns from the
    // master spec's regression list — this is deliberately a prompt-content
    // check, not a live AI call: the actual evidence judgment happens inside
    // the model, which is not a pure function this suite can call
    // deterministically. What IS deterministic and testable is that the
    // instruction the model receives is present, unambiguous, and matches
    // the specific failure patterns reported live (e.g. Redux Toolkit wrongly
    // marked a "React State Management" gap, Lighthouse/LCP wrongly marked a
    // "Core Web Vitals" gap).
    const { systemPrompt } = buildATSv2EvidenceMatrixPrompt({ rawText: 'x' } as any, { requirements: [] } as any);

    it('treats Redux Toolkit as direct evidence for React State Management, not a gap', () => {
      expect(systemPrompt).toContain('Redux Toolkit')
      expect(systemPrompt).toContain('React State Management')
      expect(systemPrompt).toMatch(/Redux Toolkit is a React state management library/)
    })

    it('treats Lighthouse + LCP as direct evidence for Core Web Vitals, not a gap', () => {
      expect(systemPrompt).toContain('Core Web Vitals')
      expect(systemPrompt).toMatch(/Lighthouse and LCP.*ARE Core Web Vitals work/)
    })

    it('treats a bare Playwright listing as partial (not automatic strong) evidence for End-to-End Testing', () => {
      expect(systemPrompt).toContain('Playwright')
      expect(systemPrompt).toMatch(/Default to "partial".*unless the resume text explicitly ties it to writing or running end-to-end tests/)
    })

    it('treats GitHub Actions as partial/related (not automatic strong) evidence for CI/CD', () => {
      expect(systemPrompt).toContain('GitHub Actions')
      expect(systemPrompt).toMatch(/Treat as "related"\/"partial" evidence by default/)
    })
  })

  describe('Abbreviation normalization (JS/TS/etc. must not read as a gap)', () => {
    it('the evidence-matrix prompt treats common abbreviations as the same capability on either side', () => {
      const { systemPrompt } = buildATSv2EvidenceMatrixPrompt({ rawText: 'x' } as any, { requirements: [] } as any);

      expect(systemPrompt).toMatch(/JS = JavaScript/)
      expect(systemPrompt).toMatch(/TS = TypeScript/)
      expect(systemPrompt).toContain('Postgres = PostgreSQL')
      expect(systemPrompt).toContain('Mongo = MongoDB')
      // The normalization must not widen into an unrelated inference — a
      // spelling equivalence is not license to assume adjacent skills.
      expect(systemPrompt).toMatch(/GitHub still does NOT imply GitHub Actions/)
    })

    it('the JD extraction prompt normalizes requirement names to canonical spelling without touching the verbatim quote', () => {
      const { systemPrompt } = buildJDExtractionPrompt('x'.repeat(120))

      expect(systemPrompt).toMatch(/JS -> JavaScript/)
      expect(systemPrompt).toMatch(/TS -> TypeScript/)
      // exactQuote must stay verbatim — the normalization instruction must
      // say so explicitly rather than leaving the two rules to conflict.
      expect(systemPrompt).toMatch(/exactQuote stays verbatim from the JD/)
    })
  })

  describe('CGPA Logic (Tests D, E, F)', () => {
    // jdRequirementSchema also requires `provenance`; without it the same
    // parse() call threw on ["atsV2","structuredJd","requirements",0,"provenance"].
    const VALID_REQUIREMENT = {
      id: 'req_1',
      name: 'React',
      category: 'technical_capability' as const,
      importance: 'high' as const,
      description: 'React experience required.',
      provenance: { exactQuote: 'Experience with React', context: 'Requirements' },
    }

    // The response schema requires evidenceReferences, confidence and
    // semanticReasoning on every evaluation. Omitting them made
    // atsCheckResponseSchema.parse() throw a ZodError, so the route returned a
    // 500 and the assertions below read an error body instead of a report.
    const VALID_EVALUATION = {
      capabilityId: 'req_1',
      satisfaction: 'complete' as const,
      evidenceStrength: 'strong' as const,
      evidenceReferences: [],
      confidence: 0.9,
      semanticReasoning: 'Resume shows direct React project and internship experience.',
    }

    // Minimum viable resume for the V2 pipeline. Quality scoring reads these,
    // so omitting them made the whole pipeline throw before the CGPA rule ran.
    const BASE_RESUME = {
      name: 'Test Candidate',
      email: 'test@example.com',
      summary: 'Frontend developer with React and TypeScript experience.',
      skills: ['React', 'TypeScript', 'JavaScript'],
      experience: [
        { company: 'Acme', role: 'Frontend Intern', start_date: '2024-01', end_date: '2024-06',
          bullets: ['Built React components used across the product.'] },
      ],
      projects: [{ name: 'Portfolio', description: 'Personal site', technologies: ['React'] }],
    }

    // Inline resume data, under the field name the route actually reads
    // (`resumeData`). Previously this was `parsedResumeData` — which the route
    // ignores — alongside a resumeId, so the stored resume was scored instead
    // and the GPAs under test never reached the CGPA rule.
    const validBody = {
      targetRole: 'Frontend Developer',
      companyName: 'Acme Corp',
      jobDescription: 'A'.repeat(150),
      jobUrl: 'https://acmecorp.com/jobs/1'
    };

    it('TEST D: B.Tech (9.5) + B.Sc (7.17) (No CGPA recommendation)', async () => {
      // Setup successful V2 response so we hit the CGPA logic at the end
      mockExtractJDIntelligence.mockResolvedValue({ success: true, data: { requirements: [VALID_REQUIREMENT] } });
      mockEvaluateResumeEvidence.mockResolvedValue({ success: true, data: { evaluations: [VALID_EVALUATION] } });
      
      const body = {
        ...validBody,
        resumeData: {
          ...BASE_RESUME,
          education: [
            { degree: 'B.Tech', gpa: 9.5, graduation_year: 2026 },
            { degree: 'B.Sc', gpa: 7.17, graduation_year: 2026 }
          ]
        }
      };
      
      const req = createRequest(body);
      const res = await POST(req);
      const json = await res.json();

      expect(json.academicRecommendation).toBeNull();
    });

    it('TEST E: Currently pursuing B.Tech (7.49) (Show recommendation)', async () => {
      mockExtractJDIntelligence.mockResolvedValue({ success: true, data: { requirements: [VALID_REQUIREMENT] } });
      mockEvaluateResumeEvidence.mockResolvedValue({ success: true, data: { evaluations: [VALID_EVALUATION] } });
      
      const body = {
        ...validBody,
        resumeData: {
          ...BASE_RESUME,
          education: [
            { degree: 'Bachelor of Technology', gpa: 7.49, graduation_year: 2030 }
          ]
        }
      };
      
      const req = createRequest(body);
      const res = await POST(req);
      const json = await res.json();

      expect(json.academicRecommendation?.visible).toBe(true);
      expect(json.academicRecommendation?.observed).toBe('7.49');
    });

    it('TEST F: Currently pursuing B.Tech (7.5) (No recommendation)', async () => {
      mockExtractJDIntelligence.mockResolvedValue({ success: true, data: { requirements: [VALID_REQUIREMENT] } });
      mockEvaluateResumeEvidence.mockResolvedValue({ success: true, data: { evaluations: [VALID_EVALUATION] } });
      
      const body = {
        ...validBody,
        resumeData: {
          ...BASE_RESUME,
          education: [
            { degree: 'B.E.', gpa: 7.5, graduation_year: 2030 }
          ]
        }
      };
      
      const req = createRequest(body);
      const res = await POST(req);
      const json = await res.json();

      expect(json.academicRecommendation).toBeNull();
    });
  });

  describe('Failure Modes (Tests G, H)', () => {
    const validBody = {
      resumeId: '123',
      targetRole: 'Frontend Developer',
      companyName: 'Acme Corp',
      jobDescription: 'A'.repeat(150),
      jobUrl: 'https://acmecorp.com/jobs/1'
    };

    it('TEST G: All V2 providers fail (Expect aiFailed state and no score)', async () => {
      mockExtractJDIntelligence.mockRejectedValue(new Error('AI Failed'));

      const req = createRequest(validBody);
      const res = await POST(req);
      const json = await res.json();

      expect(json.aiFailed).toBe(true);
      expect(json.atsV2).toBeUndefined();
      // The real cause (an exception, not "no meaningful requirements")
      // must be reported accurately, not a generic message regardless
      // of what actually failed.
      expect(json.analysisError.stage).toBe('unexpected');
      expect(json.analysisError.message).toContain('AI Failed');
      // The resume-only readiness score is still real and shown, never
      // fabricated to stand in for the targeted match that failed.
      expect(json.mode).toBe('targeted');
      expect(json.readiness.score).toBeGreaterThanOrEqual(0);
    });

    it('TEST H: Meaningful JD + empty requirement strings (Expect extraction failure, no default score)', async () => {
      // In V2, the jdValidator fails on empty requirement strings and returns { valid: false }.
      // This causes the AI call to fail (or exhaust retries) and ultimately extractJDIntelligence returns success: false.
      mockExtractJDIntelligence.mockResolvedValue({ success: false, error: 'AI provider sequence failed: Validation Error' });

      const req = createRequest(validBody);
      const res = await POST(req);
      const json = await res.json();

      // We expect aiFailed to be true and no V2 score to be returned
      expect(json.aiFailed).toBe(true);
      expect(json.atsV2).toBeUndefined();
      expect(json.analysisError.stage).toBe('jd_extraction');
      expect(json.analysisError.message).toContain('Validation Error');
    });
  });

  describe('Resume-only mode (no job description supplied)', () => {
    it('runs a readiness-only analysis without touching the V2 pipeline at all', async () => {
      const req = createRequest({
        resumeId: '123',
        jobDescription: '',
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.mode).toBe('resume_only');
      expect(json.atsV2).toBeUndefined();
      expect(json.analysisError).toBeNull();
      expect(json.aiFailed).toBe(false);
      expect(json.readiness.score).toBeGreaterThanOrEqual(0);
      // No JD was supplied, so there is nothing to extract — the V2 pipeline
      // must never be invoked for this mode.
      expect(mockExtractJDIntelligence).not.toHaveBeenCalled();
      expect(mockEvaluateResumeEvidence).not.toHaveBeenCalled();
    });

    it('omitting targetRole/companyName is valid when there is no job description', async () => {
      const req = createRequest({ resumeId: '123', jobDescription: '   ' });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  describe('DB persistence uses the same score the response shows', () => {
    it('stores atsV2 overallScore, never a different number, when targeted analysis succeeds', async () => {
      const VALID_REQUIREMENT = {
        id: 'req_1',
        name: 'React',
        category: 'technical_capability' as const,
        importance: 'high' as const,
        description: 'React experience required.',
        provenance: { exactQuote: 'Experience with React', context: 'Requirements' },
      }
      const VALID_EVALUATION = {
        capabilityId: 'req_1',
        satisfaction: 'complete' as const,
        evidenceStrength: 'strong' as const,
        evidenceReferences: [],
        confidence: 0.9,
        semanticReasoning: 'Resume shows direct React project experience.',
      }
      mockExtractJDIntelligence.mockResolvedValue({ success: true, data: { requirements: [VALID_REQUIREMENT] } });
      mockEvaluateResumeEvidence.mockResolvedValue({ success: true, data: { evaluations: [VALID_EVALUATION] } });

      insertCalls.length = 0

      const req = createRequest({
        resumeId: '123',
        targetRole: 'Frontend Developer',
        companyName: 'Acme Corp',
        jobDescription: 'A'.repeat(150),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.atsV2).toBeDefined();
      expect(insertCalls).toHaveLength(1);
      // The score written to resume_ats_reports must be the exact same
      // number the response carries — there is only one engine now, so
      // there is nothing else it could legitimately be, and no way for the
      // database and the screen to disagree.
      expect((insertCalls[0] as { score: number }).score).toBe(json.atsV2.score.overallScore);
    });
  });
});
