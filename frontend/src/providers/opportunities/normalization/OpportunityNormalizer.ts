import { NormalizedOpportunity } from '../types/NormalizedOpportunity';

/**
 * Safely parses a deadline string into an ISO timestamp.
 *
 * Handles:
 *   - Standard ISO strings: "2026-06-20T00:00:00Z"
 *   - Internshala shorthand: "12 Jun '26", "2 Jul '26"  ← apostrophe year
 *   - Plain date strings:    "20 Jun 2026", "July 11 2026"
 *   - Unix timestamps (number)
 *   - "Rolling" / empty → null
 *
 * Guards:
 *   - Any parsed date before year 2024 is rejected as a parsing failure.
 *     This catches the V8 bug where "12 Jun '26" → 2020 in IST timezone.
 */
function parseSafeDeadline(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const str = String(raw).trim();
  if (!str || str.toLowerCase() === 'rolling') return null;

  // ── Internshala apostrophe-year format: "12 Jun '26" → "12 Jun 2026" ──
  // Replace the shorthand 'YY pattern with 20YY.
  // The apostrophe can be a straight quote (U+0027) or curly quote (U+2019).
  const normalized = str
    .replace(/[\u2018\u2019']\s*(\d{2})(?=\s*$|\s)/g, '20$1') // "'26" → "2026"
    .replace(/[\u2018\u2019'](\d{2})/g, '20$1');               // fallback: "'26" anywhere

  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;

  // Guard: reject dates before 2024 — these are certainly parsing failures,
  // not genuine opportunity deadlines (platform launched in 2026).
  if (d.getFullYear() < 2024) {
    console.warn(`[OpportunityNormalizer] Rejected suspect deadline "${str}" → parsed as ${d.toISOString().substring(0, 10)} (before 2024 guard)`);
    return null;
  }

  return d.toISOString();
}

export class OpportunityNormalizer {
  static normalize(
    rawData: any,
    providerSource: string
  ): NormalizedOpportunity {
    return {
      title: rawData.title || rawData.job_title || 'Unknown Title',
      company: rawData.company || rawData.company_name || 'Unknown Company',
      location: rawData.location || 'Remote',
      description: rawData.description || rawData.details || '',
      skills: Array.isArray(rawData.skills) ? rawData.skills : [],
      deadline: parseSafeDeadline(rawData.deadline),
      posted_at: rawData.posted_at || undefined,
      source: providerSource,
      source_id: rawData.id || rawData.source_id || '',
      apply_url: rawData.apply_url || rawData.url || '',
      category: rawData.category || 'Job',
      company_logo_url: rawData.company_logo_url || rawData.logoUrl || rawData.logo || undefined,
      employment_type: rawData.employment_type || rawData.employmentType || rawData.type || undefined,
      requirements: Array.isArray(rawData.requirements) ? rawData.requirements : [],
      quality_score: typeof rawData.quality_score === 'number' ? rawData.quality_score : 0,
      salary_range: rawData.salary_range || undefined,
      mode: rawData.mode || rawData.work_mode || undefined,
      experience_level: rawData.experience_level || undefined,
      source_url: rawData.source_url || rawData.apply_url || rawData.url || undefined,
    };
  }
}
