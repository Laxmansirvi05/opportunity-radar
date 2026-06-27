import React from "react";
import { AwardsSection as AwardsSectionData } from "@/features/resume-toolkit/lib/schema/resume/data";
import { SectionProps } from "../types";

export function AwardsSection({ data }: SectionProps<AwardsSectionData>) {
  if (data.hidden || !data.items || data.items.length === 0) return null;

  return (
    <section className="resume-section awards-section flex flex-col gap-3">
      <h3 className="text-[14px] font-bold uppercase tracking-wider text-[var(--color-primary)] border-b border-[var(--color-primary)]/20 pb-1 mb-2">
        {data.title || "Awards"}
      </h3>
      
      <div className="flex flex-col gap-3">
        {data.items.map((item) => {
          if (item.hidden) return null;
          
          return (
            <div key={item.id} className="flex flex-col gap-0.5 break-inside-avoid">
              <div className="flex justify-between items-start gap-4">
                <span className="text-[13px] font-semibold text-[var(--color-text)]">
                  {item.title}
                </span>
                <span className="text-[11px] text-[var(--color-text)] opacity-70 shrink-0">
                  {item.date}
                </span>
              </div>
              <span className="text-[12px] font-medium text-[var(--color-text)] opacity-90">
                {item.awarder}
              </span>
              {item.website?.url && (
                <a href={item.website.url} className="text-[11px] text-[var(--color-primary)] underline mt-0.5">
                  {item.website.label || item.website.url}
                </a>
              )}
              {item.description && (
                <div 
                  className="text-[11.5px] leading-relaxed text-[var(--color-text)] opacity-85 mt-1 prose prose-sm max-w-none prose-p:my-0"
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
