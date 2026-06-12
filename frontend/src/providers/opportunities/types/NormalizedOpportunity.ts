export interface NormalizedOpportunity {
  title: string;
  company: string;
  location: string;
  description: string;
  skills: string[];
  deadline: string | null;
  source: string;
  source_id: string;
  apply_url: string;
  category: string;
  event_date?: string;
  registration_deadline?: string;
  program_duration?: string;
  // Enrichment fields — optional so all other providers remain unaffected
  source_url?: string;
  mode?: string;
  is_paid?: boolean;
  salary_range?: string;
  verified?: boolean;
  experience_level?: string;
}
