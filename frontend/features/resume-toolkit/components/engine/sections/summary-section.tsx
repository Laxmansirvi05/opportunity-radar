import React from "react";
import { Summary } from "@/features/resume-toolkit/lib/schema/resume/data";
import { SectionProps } from "../types";

export function SummarySection({ data }: SectionProps<Summary>) {
  if (data.hidden || !data.content) return null;

  return (
    <section className="resume-section summary-section flex flex-col gap-2" style={{ pageBreakInside: "avoid" }}>
      <h3 className="text-[14px] font-bold uppercase tracking-wider text-[var(--color-primary)] border-b border-[var(--color-primary)]/20 pb-1 mb-2">
        {data.title || "Summary"}
      </h3>
      <div 
        className="text-[12px] leading-relaxed text-[var(--color-text)] prose prose-sm max-w-none prose-p:my-1"
        dangerouslySetInnerHTML={{ __html: data.content }}
      />
    </section>
  );
}
