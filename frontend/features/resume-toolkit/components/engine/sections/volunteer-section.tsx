import React from "react";
import { VolunteerSection as VolunteerSectionData } from "@/features/resume-toolkit/lib/schema/resume/data";
import { SectionProps } from "../types";

export function VolunteerSection({ data }: SectionProps<VolunteerSectionData>) {
  if (data.hidden || !data.items || data.items.length === 0) return null;

  return (
    <section className="resume-section volunteer-section flex flex-col gap-3">
      <h3 className="text-[14px] font-bold uppercase tracking-wider text-[var(--color-primary)] border-b border-[var(--color-primary)]/20 pb-1 mb-2">
        {data.title || "Volunteer"}
      </h3>
      
      <div className="flex flex-col gap-4">
        {data.items.map((item) => {
          if (item.hidden) return null;
          
          return (
            <div key={item.id} className="flex flex-col gap-1" style={{ pageBreakInside: "avoid" }}>
              <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-[var(--color-text)]">
                    {item.organization}
                  </span>
                  {item.website?.url && (
                    <a href={item.website.url} className="text-[11px] text-[var(--color-primary)] underline mt-0.5">
                      {item.website.label || item.website.url}
                    </a>
                  )}
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
              
              {item.description && (
                <div 
                  className="text-[11.5px] leading-relaxed text-[var(--color-text)] opacity-85 mt-1 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0"
                  dangerouslySetInnerHTML={{ __html: item.description }}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
