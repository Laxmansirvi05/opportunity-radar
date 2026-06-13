'use client'

import React from 'react'
import Link from 'next/link'
import { OpportunityWithDetails } from '@/types/opportunity'
import { BookmarkIconButton } from './bookmark-icon-button'
import { CompanyLogo } from '../company-logo'
import sanitizeHtml from 'sanitize-html'

/**
 * Opportunity search result card matching the Stitch design exactly.
 *
 * Layout:
 * - Company logo (14×14 container, 8×8 inner) + Title + Company · Mode
 * - Tags row (rounded chips)
 * - Footer: Location (left) + Deadline badge (right)
 * - Bookmark button (top-right)
 *
 * Hover: border-primary/40, shadow-lg, -translate-y-0.5
 */
interface OpportunitySearchCardProps {
  opportunity: OpportunityWithDetails
}

export const OpportunitySearchCard = React.memo(function OpportunitySearchCard({ opportunity }: OpportunitySearchCardProps) {
  const company = opportunity.companies
  const tags = opportunity.opportunity_tags ?? []
  const deadlineText = getDeadlineText(opportunity.deadline)
  const isClosingSoon = opportunity.status === 'Closing Soon'

  const sanitizedDescription = React.useMemo(() => {
    return opportunity.description 
      ? sanitizeHtml(opportunity.description, { allowedTags: [], allowedAttributes: {} })
      : null
  }, [opportunity.description])

  return (
    <Link
      href={`/opportunities/${opportunity.id}`}
      className="block"
    >
      <div className="bg-surface border border-outline-variant rounded-2xl p-6 hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group relative cursor-pointer flex flex-col gap-5">
        {/* Header: Logo + Title + Bookmark */}
        <div className="flex justify-between items-start">
          <div className="flex gap-4">
            <CompanyLogo
              src={company?.logo_url}
              alt={`${company?.name ?? 'Company'} logo`}
            />
            {/* Title + Company */}
            <div className="flex flex-col justify-center">
              <h3 className="text-lg font-semibold text-on-background group-hover:text-primary transition-colors mb-1 leading-tight">
                {opportunity.title}
              </h3>
              <p className="text-sm text-on-surface-variant flex items-center gap-1.5">
                {company && (
                  <>
                    <span className="font-medium text-on-surface">{company.name}</span>
                    <span className="w-1 h-1 rounded-full bg-outline-variant" />
                  </>
                )}
                {opportunity.mode ?? 'Remote'}
              </p>
            </div>
          </div>
          {/* Bookmark button */}
          <div className="z-10 relative">
            <BookmarkIconButton opportunityId={opportunity.id} />
          </div>
        </div>
        
        {/* Description Snippet */}
        {sanitizedDescription && (
          <p className="text-sm text-on-surface-variant line-clamp-2 leading-relaxed">
            {sanitizedDescription}
          </p>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.tag_name}
                className="px-3 py-1 rounded-lg bg-surface-container-low border border-outline-variant/50 text-xs font-medium text-on-surface group-hover:border-primary/20 transition-colors"
              >
                {tag.tag_name}
              </span>
            ))}
          </div>
        )}

        {/* Footer: Location + Deadline */}
        <div className="flex justify-between items-center border-t border-outline-variant/60 pt-4">
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">
              {opportunity.mode === 'Remote' ? 'public' : 'location_on'}
            </span>
            <span className="text-xs font-medium">
              {opportunity.location ?? (opportunity.mode === 'Remote' ? 'Remote' : 'Location TBD')}
            </span>
          </div>
          {deadlineText && (
            <div
              className={`flex items-center gap-1.5 font-semibold px-3 py-1.5 rounded-lg border text-xs ${
                isClosingSoon
                  ? 'text-tertiary-container bg-tertiary-fixed/40 border-tertiary/10'
                  : 'text-on-surface-variant bg-surface-container border-outline-variant/30'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isClosingSoon ? 'schedule' : 'calendar_today'}
              </span>
              <span>{deadlineText}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
})

// ── Helpers ───────────────────────────────────────────────────────────

function getDeadlineText(deadline: string | null): string | null {
  if (!deadline) return null

  const now = new Date()
  const deadlineDate = new Date(deadline)
  const diffMs = deadlineDate.getTime() - now.getTime()

  if (diffMs < 0) return 'Closed'

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 24) return `Closes in ${diffHours}h`
  if (diffDays === 1) return 'Closes tomorrow'
  if (diffDays <= 7) return `Closes in ${diffDays} days`
  if (diffDays <= 14) return `Closes in ${Math.ceil(diffDays / 7)} weeks`
  return `Closes in ${diffDays} days`
}
