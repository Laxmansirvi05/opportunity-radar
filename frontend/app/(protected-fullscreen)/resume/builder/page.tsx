import { redirect } from "next/navigation";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { createResume } from "@/features/resume-toolkit/services/resume-actions";

/**
 * Reactive Resume's builder is addressed by the persisted resume id. Create the
 * resume before navigating so the builder always has an authenticated record to
 * load and autosave.
 */
export default async function BuilderIndexPage() {
  const result = await createResume("Untitled Resume", defaultResumeData);

  if (!result.success) {
    throw new Error(result.error || "Unable to create resume");
  }

  redirect(`/resume/builder/${result.id}`);
}
