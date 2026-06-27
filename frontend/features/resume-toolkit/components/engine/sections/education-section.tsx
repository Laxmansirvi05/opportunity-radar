import React from "react";
import { EducationSection as EducationSectionData } from "@/features/resume-toolkit/lib/schema/resume/data";
import { SectionProps } from "../types";

export function EducationSection({ data }: SectionProps<EducationSectionData>) {
  if (data.hidden || !data.items || data.items.length === 0) return null;

  return (
    <section className="resume-section education-section flex flex-col gap-3">
      <h3 className="text-[14px] font-bold uppercase tracking-wider text-[var(--color-primary)] border-b border-[var(--color-primary)]/20 pb-1 mb-2">
        {data.title || "Education"}
      </h3>
      
      <div className="flex flex-col gap-4">
        {data.items.map((item) => {
          if (item.hidden) return null;
          
          return (
            <div key={item.id} className="flex flex-col gap-1" style={{ pageBreakInside: "avoid" }}>
              <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-[var(--color-text)]">
                    {item.school}
                  </span>
                  <span className="text-[12px] font-medium text-[var(--color-text)] opacity-90">
                    {item.degree}{item.area ? ` in ${item.area}` : ""}
                  </span>
                </div>
                <div className="flex flex-col items-end text-right shrink-0">
                  <span className="text-[11px] text-[var(--color-text)] opacity-70">
                    {item.period}
                  </span>
                  {item.location && (
                    <span className="text-[11px] text-[var(--color-text)] opacity-70">
                      {item.location}
                    </span>
                  )}
                </div>
              </div>
              
              {(item.grade || item.description) && (
                <div className="text-[11.5px] leading-relaxed text-[var(--color-text)] opacity-85 mt-1">
                  {item.grade && (
                    <div className="mb-1">
                      <span className="font-semibold">Grade/GPA: </span>
                      {item.grade}
                    </div>
                  )}
                  {item.description && (
                    <div 
                      className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0"
                      dangerouslySetInnerHTML={{ __html: item.description }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
