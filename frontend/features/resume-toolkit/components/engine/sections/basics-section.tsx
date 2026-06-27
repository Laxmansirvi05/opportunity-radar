import React from "react";
import { Basics } from "@/features/resume-toolkit/lib/schema/resume/data";
import { SectionProps } from "../types";

export function BasicsSection({ data }: SectionProps<Basics>) {
  return (
    <div className="flex flex-col text-center" style={{ pageBreakInside: "avoid" }}>
      <h1 className="text-[28px] font-bold tracking-tight text-[var(--color-primary)]">
        {data.name}
      </h1>
      <h2 className="text-[16px] font-medium mt-1 mb-3 text-[var(--color-text)] opacity-80">
        {data.headline}
      </h2>
      <div className="flex flex-wrap items-center justify-center gap-3 text-[12px] text-[var(--color-text)]">
        {data.email && <span>{data.email}</span>}
        {data.phone && (
          <>
            <span className="opacity-50">•</span>
            <span>{data.phone}</span>
          </>
        )}
        {data.location && (
          <>
            <span className="opacity-50">•</span>
            <span>{data.location}</span>
          </>
        )}
        {data.website?.url && (
          <>
            <span className="opacity-50">•</span>
            <a href={data.website.url} className="text-[var(--color-primary)] underline decoration-[var(--color-primary)]/30 underline-offset-2">
              {data.website.label || data.website.url}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
