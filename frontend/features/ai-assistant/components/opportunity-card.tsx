"use client";

import Link from "next/link";
import type { OpportunityCard } from "../types";

export function OpportunityCardInline({
  opportunity,
}: {
  opportunity: OpportunityCard;
}) {
  const deadlineLabel = opportunity.deadline
    ? `Apply before ${new Date(opportunity.deadline).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`
    : "No deadline";

  return (
    <Link
      href={`/opportunities/${opportunity.id}`}
      className="group flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 transition-all hover:border-primary/25 hover:bg-surface-container hover:shadow-sm"
    >
      {/* Company Logo */}
      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-high">
        {opportunity.companyLogo ? (
          // Company logos are supplied by the existing opportunities table and can use multiple provider domains.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={opportunity.companyLogo}
            alt={opportunity.company}
            className="w-full h-full object-contain p-1"
          />
        ) : (
          <span className="material-symbols-outlined text-on-surface-variant text-xl">
            business
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="mb-0.5 flex items-center gap-2">
          <h4 className="font-label-md text-label-md font-semibold text-on-surface truncate">
            {opportunity.title}
          </h4>
          {opportunity.matchLabel && (
            <span className="text-[10px] font-semibold text-primary bg-primary-container/30 px-2 py-0.5 rounded-full whitespace-nowrap">
              {opportunity.matchLabel}
            </span>
          )}
        </div>
        <p className="mb-1.5 text-[11px] text-on-surface-variant">
          {opportunity.company}
          {opportunity.location ? ` • ${opportunity.location}` : ""}
        </p>
        {opportunity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {opportunity.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full bg-primary-container/20 text-primary font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Deadline + Arrow */}
      <div className="flex shrink-0 items-center gap-2 text-right">
        <div className="hidden sm:block">
          <p className="whitespace-nowrap text-[10px] text-on-surface-variant">
            {deadlineLabel}
          </p>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-lg">
          chevron_right
        </span>
      </div>
    </Link>
  );
}
