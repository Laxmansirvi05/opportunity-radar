import { redirect } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

/**
 * When a user navigates to /resume/builder (without a resumeId),
 * generate a new local resume ID and redirect to the real Builder.
 */
export default function BuilderIndexPage() {
  const newResumeId = uuidv4();
  redirect(`/resume/builder/${newResumeId}`);
}
