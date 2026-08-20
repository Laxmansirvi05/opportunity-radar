import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssistantView } from "@/features/ai-assistant/components/assistant-view";

export const metadata: Metadata = {
  title: "AI Assistant | Opportunity Radar",
  description:
    "Chat with your personal career AI Assistant for opportunities, resumes, and interview prep.",
};

export default async function AssistantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userName =
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "there";

  return (
    <div className="h-[calc(100vh-4rem)] w-full overflow-hidden flex flex-col">
      <AssistantView userName={userName} />
    </div>
  );
}
