import React from "react";
import { ExperienceSection as ExperienceSectionData } from "@/features/resume-toolkit/lib/schema/resume/data";
import { SectionProps } from "../types";

export function ExperienceSection({ data }: SectionProps<ExperienceSectionData>) {
  if (data.hidden || !data.items || data.items.length === 0) return null;

  return (
    <section className="resume-section experience-section flex flex-col gap-3">
      <h3 className="text-[14px] font-bold uppercase tracking-wider text-[var(--color-primary)] border-b border-[var(--color-primary)]/20 pb-1 mb-2">
        {data.title || "Experience"}
      </h3>
      
      <div className="flex flex-col gap-4">
        {data.items.map((item) => {
          if (item.hidden) return null;
          
          return (
            <div key={item.id} className="flex flex-col gap-1" style={{ pageBreakInside: "avoid" }}>
              <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-[var(--color-text)]">
                    {item.company}
                  </span>
                  {item.position && (
                    <span className="text-[12px] font-medium text-[var(--color-text)] opacity-90">
                      {item.position}
                    </span>
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
              
              {/* For multi-role layouts */}
              {item.roles && item.roles.length > 0 && (
                <div className="flex flex-col gap-2 mt-1 ml-2 border-l-2 border-[var(--color-text)]/10 pl-3">
                  {item.roles.map((role) => (
                    <div key={role.id} className="flex flex-col">
                      <div className="flex justify-between text-[12px]">
                        <span className="font-medium">{role.position}</span>
                        <span className="text-[11px] opacity-70">{role.period}</span>
                      </div>
                      {role.description && (
                        <div 
                          className="text-[11px] leading-relaxed text-[var(--color-text)] opacity-80 mt-1 prose prose-sm max-w-none prose-p:my-0.5"
                          dangerouslySetInnerHTML={{ __html: role.description }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* General Description (if roles are empty or in addition to roles) */}
              {item.description && (!item.roles || item.roles.length === 0) && (
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
