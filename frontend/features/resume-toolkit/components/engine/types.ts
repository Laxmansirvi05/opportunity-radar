import { ResumeData } from "@/features/resume-toolkit/lib/schema/resume/data";

export interface RenderContext {
  mode: "builder" | "preview" | "pdf" | "copilot" | "ats";
  zoom: number;
  readOnly: boolean;
  print: boolean;
}

export interface ResumeRendererProps {
  resumeData: ResumeData;
  templateId?: string;
  context?: Partial<RenderContext>;
}

export interface TemplateProps {
  data: ResumeData;
  context: RenderContext;
}

export interface SectionProps<T = unknown> {
  data: T;
  context: RenderContext;
}
