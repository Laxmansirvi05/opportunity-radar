import { redirect } from "next/navigation";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { createResume } from "@/features/resume-toolkit/services/resume-actions";
import { pickReusableDraft, UNTITLED_RESUME, type DraftRow } from "@/features/resume-toolkit/lib/reusable-draft";
import { createClient } from "@/lib/supabase/server";

/**
 * Reactive Resume's builder is addressed by the persisted resume id, so a
 * record has to exist before navigating. Reuse the user's untouched blank
 * draft when there is one; only create a new resume when there is not.
 * Creating one unconditionally made every visit, refresh and link prefetch
 * add another "Untitled Resume" to the account.
 */
export default async function BuilderIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: drafts } = await supabase
      .from("resumes")
      .select("id, file_name, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("file_name", UNTITLED_RESUME)
      .order("created_at", { ascending: false })
      .limit(10);

    const reusable = pickReusableDraft((drafts ?? []) as DraftRow[]);
    if (reusable) redirect(`/resume/builder/${reusable}`);
  }

  const result = await createResume(UNTITLED_RESUME, defaultResumeData);

  if (!result.success) {
    throw new Error(result.error || "Unable to create resume");
  }

  redirect(`/resume/builder/${result.id}`);
}
