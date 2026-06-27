import React from "react";
import { SkillsSection as SkillsSectionData } from "@/features/resume-toolkit/lib/schema/resume/data";
import { SectionProps } from "../types";

export function SkillsSection({ data }: SectionProps<SkillsSectionData>) {
  if (data.hidden || !data.items || data.items.length === 0) return null;

  return (
    <section className="resume-section skills-section flex flex-col gap-3">
      <h3 className="text-[14px] font-bold uppercase tracking-wider text-[var(--color-primary)] border-b border-[var(--color-primary)]/20 pb-1 mb-2">
        {data.title || "Skills"}
      </h3>
      
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {data.items.map((item) => {
          if (item.hidden) return null;
          
          return (
            <div key={item.id} className="flex flex-col mb-2 break-inside-avoid">
              <span className="text-[12px] font-semibold text-[var(--color-text)]">
                {item.name}
              </span>
              {item.keywords && item.keywords.length > 0 && (
                <span className="text-[11.5px] text-[var(--color-text)] opacity-80 leading-relaxed mt-0.5">
                  {item.keywords.join(", ")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
