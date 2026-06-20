import { z } from 'zod';
import { resumeDataSchema } from '@reactive-resume/schema/resume/data';
import { defaultResumeData } from '@reactive-resume/schema/resume/default';
import type { ResumeData } from '@reactive-resume/schema/resume/data';

// This is the shape expected by Reactive Resume components
export const reactiveResumeSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  data: resumeDataSchema,
  userId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  visibility: z.enum(['public', 'private']).default('private'),
  locked: z.boolean().default(false),
});

export type ReactiveResume = z.infer<typeof reactiveResumeSchema>;

// This is the shape returned by Opportunity Radar's Supabase resumes table
export type SupabaseResume = {
  id: string;
  file_name: string | null;
  status: string;
  data: any; // The JSONB column
  parsed_data: any; // The JSONB column
  user_id: string;
  created_at: string;
  updated_at: string;
};

/**
 * Maps a Supabase resume row to the Reactive Resume format
 */
export function mapToReactiveResume(row: SupabaseResume): ReactiveResume {
  return {
    id: row.id,
    title: row.file_name || 'Untitled Resume',
    slug: row.id, // Opportunity Radar doesn't use slugs, so we fallback to ID
    data: mapResumeData(row.data, row.parsed_data),
    userId: row.user_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    visibility: 'private', // Default to private as OR does not have public resumes yet
    locked: false,
  };
}

/**
 * Ensures the data conforms to Reactive Resume's ResumeData schema.
 * Uses parsed_data as a fallback if data is empty.
 */
function mapResumeData(data: any, parsed_data: any): ResumeData {
  const sourceData = (data && Object.keys(data).length > 0) ? data : (parsed_data || {});
  
  // Parse through zod to strip invalid fields and apply defaults
  const parsed = resumeDataSchema.safeParse(sourceData);
  if (parsed.success) {
    return parsed.data;
  }
  
  // If parsing fails (e.g. empty object), merge with defaultResumeData
  console.warn('[Compatibility Layer] Invalid resume data, merging with defaults:', parsed.error);
  return {
    ...defaultResumeData,
    ...sourceData,
  } as ResumeData;
}

/**
 * Prepares the payload for updating the Supabase row
 */
export function mapToSupabasePayload(resume: ReactiveResume): Partial<SupabaseResume> {
  return {
    file_name: resume.title,
    data: resume.data,
  };
}
