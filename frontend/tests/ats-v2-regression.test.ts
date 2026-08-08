import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/resume/ats-check/route';
import { buildATSv2EvidenceMatrixPrompt } from '../features/resume-toolkit/services/ai/ats-v2-prompts';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({ get: vi.fn(), set: vi.fn() })
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }) },
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) })
  }),
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }) },
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) })
  })
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
    const validBody = {
      resumeId: '123',
      targetRole: 'Frontend Developer',
      companyName: 'Acme Corp',
      jobDescription: 'A'.repeat(150),
      parsedResumeData: { education: [] }, // Will override
      jobUrl: 'https://acmecorp.com/jobs/1'
    };

    it('TEST D: B.Tech (9.5) + B.Sc (7.17) (No CGPA recommendation)', async () => {
      // Setup successful V2 response so we hit the CGPA logic at the end
      mockExtractJDIntelligence.mockResolvedValue({ success: true, data: { requirements: [{ id: 'req_1', name: 'React', category: 'technical_capability', importance: 'high' }] } });
      mockEvaluateResumeEvidence.mockResolvedValue({ success: true, data: { evaluations: [{ capabilityId: 'req_1', satisfaction: 'complete', evidenceStrength: 'strong' }] } });
      
      const body = {
        ...validBody,
        parsedResumeData: {
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
      mockExtractJDIntelligence.mockResolvedValue({ success: true, data: { requirements: [{ id: 'req_1', name: 'React', category: 'technical_capability', importance: 'high' }] } });
      mockEvaluateResumeEvidence.mockResolvedValue({ success: true, data: { evaluations: [{ capabilityId: 'req_1', satisfaction: 'complete', evidenceStrength: 'strong' }] } });
      
      const body = {
        ...validBody,
        parsedResumeData: {
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
      mockExtractJDIntelligence.mockResolvedValue({ success: true, data: { requirements: [{ id: 'req_1', name: 'React', category: 'technical_capability', importance: 'high' }] } });
      mockEvaluateResumeEvidence.mockResolvedValue({ success: true, data: { evaluations: [{ capabilityId: 'req_1', satisfaction: 'complete', evidenceStrength: 'strong' }] } });
      
      const body = {
        ...validBody,
        parsedResumeData: {
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
