import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/resume/ats-check/route';
import { buildATSv2EvidenceMatrixPrompt } from '../features/resume-toolkit/services/ai/ats-v2-prompts';

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

function supabaseStub() {
  const chain: Record<string, unknown> = {}
  Object.assign(chain, {
    select: () => chain,
    insert: () => chain,
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
      
      const coaching = json.coaching;
      const suggestions = coaching.suggestions.map((s: any) => s.title);
      expect(suggestions).not.toContain('Improve Academic Standing');
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
      
      const coaching = json.coaching;
      const suggestions = coaching.suggestions.map((s: any) => s.title);
      expect(suggestions).toContain('Improve Academic Standing');
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
      
      const coaching = json.coaching;
      const suggestions = coaching.suggestions.map((s: any) => s.title);
      expect(suggestions).not.toContain('Improve Academic Standing');
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
    });
  });
});
