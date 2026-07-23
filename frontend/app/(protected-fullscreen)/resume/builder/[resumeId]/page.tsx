import { BuilderPageClient } from "@/features/resume/builder/page-client";

type PageProps = {
  params: Promise<{ resumeId: string }>;
};

export default async function BuilderPage({ params }: PageProps) {
  const { resumeId } = await params;
  return <BuilderPageClient resumeId={resumeId} />;
}
