'use client'

import { CompanyLogo } from '@/features/opportunities/components/company-logo'

/**
 * The certification row and its detail dialog, lifted out of
 * certifications-client so the ATS Score Checker can show the *same* card
 * rather than a lookalike. A second, hand-copied version would drift from
 * this one the first time either was touched.
 */

export interface Certification {
  id: string
  title: string
  provider: string
  provider_logo: string | null
  certificate_image: string | null
  description: string | null
  url: string
  is_free: boolean
  price_label: string | null
  level: string | null
  duration: string | null
  topics: string[] | null
  has_certificate: boolean | null
}

export const LEVEL_STYLES: Record<string, string> = {
  Beginner: 'bg-secondary-container text-on-secondary-container',
  Intermediate: 'bg-tertiary-container text-on-tertiary-container',
  Advanced: 'bg-primary-container text-on-primary-container',
}

const TOPICS_PREVIEW_COUNT = 3

export function CertificationCard({
  certification: c,
  onSelect,
}: {
  certification: Certification
  onSelect: (certification: Certification) => void
}) {
  const extraTopics = (c.topics?.length ?? 0) - TOPICS_PREVIEW_COUNT

  return (
    <button
      onClick={() => onSelect(c)}
      className="text-left bg-surface border border-outline-variant rounded-lg px-[18px] py-[14px] shadow-sm hover:border-primary hover:shadow-md transition-all cursor-pointer flex items-center gap-[14px] group w-full"
    >
      <CompanyLogo
        src={c.provider_logo}
        name={c.provider}
        alt={`${c.provider} logo`}
        containerClassName="w-11 h-11 rounded-md bg-surface-container-lowest flex items-center justify-center border border-outline-variant/60 overflow-hidden shrink-0"
        imageClassName="w-[27px] h-[27px] object-contain"
      />
      <div className="flex-1 min-w-0">
        <h3 className="text-[17px] font-semibold text-on-background truncate group-hover:text-primary transition-colors leading-snug">
          {c.title}
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <p className="text-sm text-on-surface-variant truncate">{c.provider}</p>
          {c.duration && (
            <span className="text-sm text-on-surface-variant/80 shrink-0">· {c.duration}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
          {c.level && (
            <span
              className={`px-2 py-[3px] rounded text-[12px] font-bold uppercase tracking-wide shrink-0 ${
                LEVEL_STYLES[c.level] ?? 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {c.level}
            </span>
          )}
          {c.has_certificate && (
            <span className="flex items-center gap-0.5 px-2 py-[3px] rounded text-[12px] font-medium bg-surface-container text-on-surface-variant shrink-0">
              <span className="material-symbols-outlined text-[13px]">workspace_premium</span>
              Certificate
            </span>
          )}
          {c.topics?.slice(0, TOPICS_PREVIEW_COUNT).map((t) => (
            <span key={t} className="px-2 py-[3px] rounded text-[12px] font-medium bg-surface-container text-on-surface-variant shrink-0">
              {t}
            </span>
          ))}
          {extraTopics > 0 && (
            <span className="text-[12px] text-on-surface-variant/70 shrink-0">+{extraTopics} more</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`px-2.5 py-[5px] rounded text-[13px] font-bold ${
            c.is_free
              ? 'bg-secondary-container text-on-secondary-container'
              : 'bg-surface-container text-on-surface-variant'
          }`}
        >
          {c.is_free ? 'Free' : 'Paid'}
        </span>
        <span className="material-symbols-outlined text-[21px] text-outline group-hover:text-primary transition-colors">
          chevron_right
        </span>
      </div>
    </button>
  )
}

function Chip({ label, highlight = false }: { label: string; highlight?: boolean }) {
  return (
    <span
      className={`px-3.5 py-2 rounded-lg text-sm font-semibold ${
        highlight ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'
      }`}
    >
      {label}
    </span>
  )
}

export function CertificationDetailModal({
  certification: selected,
  onClose,
}: {
  certification: Certification
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={selected.title}
    >
      <div
        className="bg-surface w-full md:max-w-2xl max-h-[85vh] rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-outline-variant flex items-start gap-4">
          <CompanyLogo
            src={selected.provider_logo}
            name={selected.provider}
            alt={`${selected.provider} logo`}
            containerClassName="w-[70px] h-[70px] rounded-xl bg-surface-container-lowest flex items-center justify-center border border-outline-variant/60 overflow-hidden shrink-0"
            imageClassName="w-11 h-11 object-contain"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-on-background">{selected.title}</h2>
            <p className="text-base text-on-surface-variant mt-0.5">{selected.provider}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex flex-col gap-5">
          {selected.certificate_image && (
            <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4 flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- external, unpredictable-aspect-ratio badge art from many source domains */}
              <img
                src={selected.certificate_image}
                alt={`${selected.title} certificate preview`}
                className="max-h-52 object-contain"
              />
              <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
                Certificate preview
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Chip label={selected.price_label ?? (selected.is_free ? 'Free' : 'Paid')} highlight={selected.is_free} />
            {selected.duration && <Chip label={selected.duration} />}
            {selected.level && <Chip label={selected.level} />}
            {selected.has_certificate && <Chip label="Certificate on completion" />}
          </div>

          {selected.description && (
            <div>
              <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                About this certification
              </h3>
              <p className="text-base text-on-surface leading-relaxed whitespace-pre-line">
                {selected.description}
              </p>
            </div>
          )}

          {selected.topics && selected.topics.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Topics</h3>
              <div className="flex flex-wrap gap-2">
                {selected.topics.map((t) => (
                  <span key={t} className="px-3 py-1.5 rounded-md text-sm font-medium bg-surface-container text-on-surface-variant">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-outline-variant bg-surface-container-lowest">
          <a
            href={selected.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-primary text-on-primary font-bold text-base shadow-sm hover:opacity-90 transition-opacity"
          >
            Enrol now
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </a>
          <p className="text-xs text-center text-on-surface-variant/80 mt-2">
            You will be redirected to {selected.provider}.
          </p>
        </div>
      </div>
    </div>
  )
}
