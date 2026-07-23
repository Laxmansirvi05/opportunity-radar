import { BuilderPageClient } from "@/features/resume/builder/page-client";
import { getResumeById } from "@/features/resume-toolkit/services/resume-actions";
import { notFound } from "next/navigation";
import type { Resume } from "@/features/resume/builder/draft";
import { resumeDataSchema } from "@reactive-resume/schema/resume/data";

type PageProps = {
  params: Promise<{ resumeId: string }>;
};

export default async function BuilderPage({ params }: PageProps) {
  const { resumeId } = await params;
  
  const result = await getResumeById(resumeId);
  if (!result.success || !result.resume) {
    notFound();
  }

  const initialResume: Resume = {
    id: result.resume.id,
    name: result.resume.title,
    slug: result.resume.slug,
    tags: result.resume.tags || [],
    data: resumeDataSchema.parse(result.resume.data),
    isLocked: result.resume.is_locked,
    isPublic: result.resume.is_public,
    updatedAt: new Date(result.resume.updated_at),
  };

  return <BuilderPageClient initialResume={initialResume} />;
}
