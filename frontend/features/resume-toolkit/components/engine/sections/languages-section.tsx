import React from "react";
import { LanguagesSection as LanguagesSectionData } from "@/features/resume-toolkit/lib/schema/resume/data";
import { SectionProps } from "../types";

export function LanguagesSection({ data }: SectionProps<LanguagesSectionData>) {
  if (data.hidden || !data.items || data.items.length === 0) return null;

  return (
    <section className="resume-section languages-section flex flex-col gap-3">
      <h3 className="text-[14px] font-bold uppercase tracking-wider text-[var(--color-primary)] border-b border-[var(--color-primary)]/20 pb-1 mb-2">
        {data.title || "Languages"}
      </h3>
      
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {data.items.map((item) => {
          if (item.hidden) return null;
          
          return (
            <div key={item.id} className="flex flex-col mb-1 break-inside-avoid min-w-[120px]">
              <span className="text-[12px] font-semibold text-[var(--color-text)]">
                {item.language}
              </span>
              {item.fluency && (
                <span className="text-[11px] text-[var(--color-text)] opacity-80 leading-relaxed mt-0.5">
                  {item.fluency}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
