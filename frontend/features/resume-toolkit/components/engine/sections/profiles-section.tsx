import React from "react";
import { ProfilesSection as ProfilesSectionData } from "@/features/resume-toolkit/lib/schema/resume/data";
import { SectionProps } from "../types";

export function ProfilesSection({ data }: SectionProps<ProfilesSectionData>) {
  if (data.hidden || !data.items || data.items.length === 0) return null;

  return (
    <section className="resume-section profiles-section flex flex-col gap-3">
      <h3 className="text-[14px] font-bold uppercase tracking-wider text-[var(--color-primary)] border-b border-[var(--color-primary)]/20 pb-1 mb-2">
        {data.title || "Profiles"}
      </h3>
      
      <div className="flex flex-col gap-2">
        {data.items.map((item) => {
          if (item.hidden) return null;
          
          return (
            <div key={item.id} className="flex items-center gap-3 break-inside-avoid">
              <span className="text-[12px] font-semibold text-[var(--color-text)] min-w-[100px]">
                {item.network}
              </span>
              <div className="text-[12px] text-[var(--color-text)] opacity-90">
                {item.website?.url ? (
                  <a href={item.website.url} className="text-[var(--color-primary)] underline">
                    {item.username || item.website.label || item.website.url}
                  </a>
                ) : (
                  <span>{item.username}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
