'use client'

import { useState, useEffect, useRef } from 'react'
import { CompanyLogo } from '@/features/opportunities/components/company-logo'
import { useCertificationResults, type CertificationFiltersState } from '../hooks/use-certification-results'
import { DURATION_BUCKETS, type DurationBucketKey } from '../lib/duration'
import type { PriceFilter } from '../services/certification-search'

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

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const
type Level = (typeof LEVELS)[number]

const LEVEL_STYLES: Record<string, string> = {
  Beginner: 'bg-secondary-container text-on-secondary-container',
  Intermediate: 'bg-tertiary-container text-on-tertiary-container',
  Advanced: 'bg-primary-container text-on-primary-container',
}
const TOPICS_PREVIEW_COUNT = 3

/**
 * Certifications browser, mirroring the Search page's layout: a left
 * filters sidebar sits flush against the nav rail as a full-height flex
 * sibling of the header+results column (not stacked below a full-width
 * header) — that's what keeps the sidebar snug against the nav instead of
 * floating in a band of page padding. Certifications have no deadline, so
 * there is nothing to sort by urgency — Price, Level, Provider and Duration
 * are the filter dimensions that actually apply here.
 *
 * Data comes from useCertificationResults, which queries the server rather
 * than filtering a client-held copy of the whole ~13,000+ row catalogue —
 * that used to ship a ~10MB payload on every visit. `seed`/`seedTotal` are
 * just the first screen, fetched (and cached) server-side in page.tsx.
 */
export function CertificationsClient({
  seed,
  seedTotal,
  topProviders,
}: {
  seed: Certification[]
  seedTotal: number
  topProviders: [string, number][]
}) {
  const [query, setQuery] = useState('')
  const [price, setPrice] = useState<PriceFilter>('all')
  const [levels, setLevels] = useState<Set<Level>>(new Set())
  const [durations, setDurations] = useState<Set<DurationBucketKey>>(new Set())
  const [providers, setProviders] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Certification | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filters: CertificationFiltersState = { query, price, levels, providers, durations }
  const { items, total, loading, hasMore, loadMore } = useCertificationResults(filters, seed, seedTotal)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!hasMore) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: '600px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  const activeFilterCount = (price !== 'all' ? 1 : 0) + levels.size + durations.size + providers.size

  const toggleLevel = (l: Level) => {
    setLevels((prev) => {
      const next = new Set(prev)
      if (next.has(l)) next.delete(l)
      else next.add(l)
      return next
    })
  }
  const toggleDuration = (d: DurationBucketKey) => {
    setDurations((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }
  const toggleProvider = (p: string) => {
    setProviders((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }
  const clearAllFilters = () => {
    setPrice('all')
    setLevels(new Set())
    setDurations(new Set())
    setProviders(new Set())
  }

  // Close the detail panel on Escape, matching the rest of the app's dialogs.
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  // Duration is filtered client-side after the fact (no stored column to
  // filter server-side on — see lib/duration.ts), so the server's count is
  // an overcount whenever it's active. Showing a false precise number would
  // be worse than an honest "X shown so far".
  const countLabel =
    total != null
      ? `${total.toLocaleString('en-IN')} ${total === 1 ? 'certification' : 'certifications'}`
      : `${items.length.toLocaleString('en-IN')}+ certifications shown`

  return (
    <div className="flex h-full w-full overflow-hidden bg-surface-container-lowest">
      <CertificationsFiltersSidebar
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        price={price}
        setPrice={setPrice}
        levels={levels}
        toggleLevel={toggleLevel}
        durations={durations}
        toggleDuration={toggleDuration}
        topProviders={topProviders}
        providers={providers}
        toggleProvider={toggleProvider}
        clearAllFilters={clearAllFilters}
        activeFilterCount={activeFilterCount}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header: title + search */}
        <div className="px-4 md:px-8 pt-4 md:pt-6 pb-4 md:pb-5 border-b border-outline-variant bg-surface z-20 sticky top-0 shrink-0">
          <div className="max-w-6xl mx-auto w-full flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-on-background leading-tight">Certifications</h1>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  {seedTotal.toLocaleString('en-IN')} courses and certifications you can start any time — no deadlines.
                </p>
              </div>
              <button
                onClick={() => setFiltersOpen(true)}
                className="md:hidden shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-outline-variant bg-surface text-sm font-semibold text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">tune</span>
                Filters
                {activeFilterCount > 0 && (
                  <span className="w-4.5 h-4.5 rounded-full bg-primary text-on-primary text-[11px] flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[21px] pointer-events-none">
                search
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search certifications or providers…"
                aria-label="Search certifications"
                className="w-full pl-11 pr-4 py-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-base text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-shadow"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto w-full flex flex-col gap-3 pb-24">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-sm font-medium text-on-surface-variant">{countLabel}</span>
            </div>

            {items.length === 0 && !loading && !hasMore ? (
              <div className="bg-surface border border-dashed border-outline-variant rounded-xl p-10 flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-outline text-[40px] mb-2">school</span>
                <h2 className="font-bold text-on-surface mb-1 text-sm">No certifications found</h2>
                <p className="text-xs text-on-surface-variant max-w-md">
                  Try a different search term, or clear some filters.
                </p>
              </div>
            ) : (
              <>
                {items.map((c) => {
                  const extraTopics = (c.topics?.length ?? 0) - TOPICS_PREVIEW_COUNT
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="text-left bg-surface border border-outline-variant rounded-lg px-[18px] py-[14px] shadow-sm hover:border-primary hover:shadow-md transition-all cursor-pointer flex items-center gap-[14px] group"
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
                })}

                {(hasMore || loading) && (
                  <div ref={sentinelRef} className="flex items-center justify-center py-6 text-xs text-on-surface-variant">
                    {items.length === 0 ? 'Searching the full catalogue…' : 'Loading more…'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-6"
          onClick={() => setSelected(null)}
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
                onClick={() => setSelected(null)}
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
      )}
    </div>
  )
}

// ── Filters sidebar ──────────────────────────────────────────────────────

function CertificationsFiltersSidebar({
  isOpen,
  onClose,
  price,
  setPrice,
  levels,
  toggleLevel,
  durations,
  toggleDuration,
  topProviders,
  providers,
  toggleProvider,
  clearAllFilters,
  activeFilterCount,
}: {
  isOpen: boolean
  onClose: () => void
  price: PriceFilter
  setPrice: (p: PriceFilter) => void
  levels: Set<Level>
  toggleLevel: (l: Level) => void
  durations: Set<DurationBucketKey>
  toggleDuration: (d: DurationBucketKey) => void
  topProviders: [string, number][]
  providers: Set<string>
  toggleProvider: (p: string) => void
  clearAllFilters: () => void
  activeFilterCount: number
}) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-on-background/30 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}
      <aside
        className={`
          fixed inset-y-0 left-0 w-64 bg-surface shadow-2xl z-50 transform transition-transform duration-300 ease-in-out
          md:static md:h-full md:translate-x-0 md:w-60 md:shadow-none md:border-r md:border-outline-variant md:z-auto
          overflow-y-auto p-5 shrink-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-sm font-bold text-on-background uppercase tracking-wide">Filters</h2>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button onClick={clearAllFilters} className="text-primary text-[11px] font-medium hover:underline cursor-pointer">
                Clear all
              </button>
            )}
            <button
              className="md:hidden text-on-surface-variant p-1.5 hover:bg-surface-container rounded-full transition-colors cursor-pointer"
              onClick={onClose}
              aria-label="Close filters"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        <FilterSection title="Price">
          <div className="flex flex-col gap-1.5">
            {([
              { key: 'all', label: 'All' },
              { key: 'free', label: 'Free' },
              { key: 'paid', label: 'Paid' },
            ] as const).map((opt) => (
              <label key={opt.key} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="price"
                  checked={price === opt.key}
                  onChange={() => setPrice(opt.key)}
                  className="w-3.5 h-3.5 border-outline text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-[13px] text-on-surface">{opt.label}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Level">
          <div className="flex flex-col gap-1.5">
            {LEVELS.map((l) => (
              <label key={l} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={levels.has(l)}
                  onChange={() => toggleLevel(l)}
                  className="w-3.5 h-3.5 rounded border-outline text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-[13px] text-on-surface">{l}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Duration">
          <div className="flex flex-col gap-1.5">
            {DURATION_BUCKETS.map((b) => (
              <label key={b.key} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={durations.has(b.key)}
                  onChange={() => toggleDuration(b.key)}
                  className="w-3.5 h-3.5 rounded border-outline text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-[13px] text-on-surface">{b.label}</span>
              </label>
            ))}
          </div>
          <p className="text-[10.5px] text-on-surface-variant/70 mt-2 leading-snug">
            Estimated from each provider&apos;s own listed duration — exact hours vary by pace.
          </p>
        </FilterSection>

        <FilterSection title="Provider">
          <div className="flex flex-col gap-1.5">
            {topProviders.map(([p, count]) => (
              <label key={p} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={providers.has(p)}
                  onChange={() => toggleProvider(p)}
                  className="w-3.5 h-3.5 rounded border-outline text-primary focus:ring-primary cursor-pointer shrink-0"
                />
                <span className="text-[13px] text-on-surface truncate">{p}</span>
                <span className="text-[11px] text-on-surface-variant/70 ml-auto shrink-0">{count.toLocaleString('en-IN')}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      </aside>
    </>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-[10px] font-semibold text-on-surface-variant mb-2.5 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
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
