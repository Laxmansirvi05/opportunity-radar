'use client'

import { useState, useMemo, useEffect } from 'react'
import { CompanyLogo } from '@/features/opportunities/components/company-logo'

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

type PriceFilter = 'all' | 'free' | 'paid'
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const
type Level = (typeof LEVELS)[number]

const DURATION_BUCKETS = [
  { key: 'short', label: 'Under 5 hours' },
  { key: 'medium', label: '5–20 hours' },
  { key: 'long', label: '20–100 hours' },
  { key: 'extended', label: '100+ hours' },
] as const
type DurationBucket = (typeof DURATION_BUCKETS)[number]['key']

/**
 * Best-effort hour estimate from the source's own free-text duration string
 * ("300 hours", "1 hour 30 minutes", "6 weeks", "P10W" already converted to
 * "10 weeks" upstream) — used only to sort a record into a filter bucket.
 * The original text is what's ever shown to the student; this number is
 * never displayed. Weeks/months are converted with a stated ~5hrs/week
 * assumption (a common self-paced MOOC norm), which is why it's a bucket
 * range rather than a precise figure.
 */
function estimateHours(duration: string | null): number | null {
  if (!duration) return null
  const d = duration.toLowerCase()
  const hourMatch = /(\d+(?:\.\d+)?)\s*hours?/.exec(d)
  const minMatch = /(\d+)\s*min/.exec(d)
  const weekMatch = /(\d+)\s*weeks?/.exec(d)
  const monthMatch = /(\d+)\s*months?/.exec(d)
  const dayMatch = /(\d+)\s*days?/.exec(d)

  if (hourMatch && !weekMatch) {
    let hours = parseFloat(hourMatch[1])
    if (minMatch) hours += parseInt(minMatch[1], 10) / 60
    return hours
  }
  if (weekMatch) return parseInt(weekMatch[1], 10) * 5
  if (monthMatch) return parseInt(monthMatch[1], 10) * 4.3 * 5
  if (dayMatch) return parseInt(dayMatch[1], 10) * 2
  if (minMatch) return parseInt(minMatch[1], 10) / 60
  return null
}

function durationBucket(duration: string | null): DurationBucket | null {
  const hours = estimateHours(duration)
  if (hours == null) return null
  if (hours < 5) return 'short'
  if (hours < 20) return 'medium'
  if (hours < 100) return 'long'
  return 'extended'
}

/**
 * Certifications browser, mirroring the Search page's layout: a left
 * filters sidebar (static on desktop, a drawer on mobile) next to the
 * results list. Certifications have no deadline, so there is nothing to
 * sort by urgency — Price, Level and Duration are the filter dimensions
 * that actually apply here.
 */
export function CertificationsClient({ initial }: { initial: Certification[] }) {
  const [query, setQuery] = useState('')
  const [price, setPrice] = useState<PriceFilter>('all')
  const [levels, setLevels] = useState<Set<Level>>(new Set())
  const [durations, setDurations] = useState<Set<DurationBucket>>(new Set())
  const [selected, setSelected] = useState<Certification | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return initial.filter((c) => {
      if (price === 'free' && !c.is_free) return false
      if (price === 'paid' && c.is_free) return false
      if (levels.size > 0 && !(c.level && levels.has(c.level as Level))) return false
      if (durations.size > 0) {
        const bucket = durationBucket(c.duration)
        if (!bucket || !durations.has(bucket)) return false
      }
      if (!q) return true
      return (
        c.title.toLowerCase().includes(q) ||
        c.provider.toLowerCase().includes(q) ||
        (c.topics ?? []).some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [initial, query, price, levels, durations])

  const activeFilterCount = (price !== 'all' ? 1 : 0) + levels.size + durations.size

  const toggleLevel = (l: Level) => {
    setLevels((prev) => {
      const next = new Set(prev)
      if (next.has(l)) next.delete(l)
      else next.add(l)
      return next
    })
  }
  const toggleDuration = (d: DurationBucket) => {
    setDurations((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }
  const clearAllFilters = () => {
    setPrice('all')
    setLevels(new Set())
    setDurations(new Set())
  }

  // Close the detail panel on Escape, matching the rest of the app's dialogs.
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-container-lowest overflow-hidden">
      {/* Header: title + search */}
      <div className="px-4 md:px-6 pt-4 md:pt-5 pb-3 md:pb-4 border-b border-outline-variant bg-surface shrink-0">
        <div className="max-w-6xl mx-auto w-full flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-on-background leading-tight">Certifications</h1>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {initial.length.toLocaleString('en-IN')} courses and certifications you can start any time — no deadlines.
              </p>
            </div>
            <button
              onClick={() => setFiltersOpen(true)}
              className="md:hidden shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs font-semibold text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              Filters
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-primary text-on-primary text-[10px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[19px] pointer-events-none">
              search
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search certifications, providers or topics…"
              aria-label="Search certifications"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-shadow"
            />
          </div>
        </div>
      </div>

      {/* Body: sidebar + results */}
      <div className="flex-1 flex overflow-hidden max-w-6xl mx-auto w-full">
        <CertificationsFiltersSidebar
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          price={price}
          setPrice={setPrice}
          levels={levels}
          toggleLevel={toggleLevel}
          durations={durations}
          toggleDuration={toggleDuration}
          clearAllFilters={clearAllFilters}
          activeFilterCount={activeFilterCount}
        />

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="w-full flex flex-col gap-2 pb-24">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-medium text-on-surface-variant">
                {results.length.toLocaleString('en-IN')} {results.length === 1 ? 'certification' : 'certifications'}
              </span>
            </div>

            {results.length === 0 ? (
              <div className="bg-surface border border-dashed border-outline-variant rounded-xl p-10 flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-outline text-[40px] mb-2">school</span>
                <h2 className="font-bold text-on-surface mb-1 text-sm">No certifications found</h2>
                <p className="text-xs text-on-surface-variant max-w-md">
                  Try a different search term, or clear some filters.
                </p>
              </div>
            ) : (
              results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="text-left bg-surface border border-outline-variant rounded-xl px-3.5 py-3 shadow-sm hover:border-primary hover:shadow-md transition-all cursor-pointer flex items-center gap-3 group"
                >
                  <CompanyLogo
                    src={c.provider_logo}
                    name={c.provider}
                    alt={`${c.provider} logo`}
                    containerClassName="w-9 h-9 rounded-lg bg-surface-container-lowest flex items-center justify-center border border-outline-variant/60 overflow-hidden shrink-0"
                    imageClassName="w-6 h-6 object-contain"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-on-background truncate group-hover:text-primary transition-colors leading-snug">
                      {c.title}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs text-on-surface-variant truncate">{c.provider}</p>
                      {c.level && (
                        <span className="text-[11px] text-on-surface-variant/80 shrink-0">· {c.level}</span>
                      )}
                      {c.duration && (
                        <span className="text-[11px] text-on-surface-variant/80 shrink-0">· {c.duration}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        c.is_free
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {c.is_free ? 'Free' : 'Paid'}
                    </span>
                    <span className="material-symbols-outlined text-[20px] text-outline group-hover:text-primary transition-colors">
                      chevron_right
                    </span>
                  </div>
                </button>
              ))
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
                containerClassName="w-14 h-14 rounded-xl bg-surface-container-lowest flex items-center justify-center border border-outline-variant/60 overflow-hidden shrink-0"
                imageClassName="w-9 h-9 object-contain"
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-on-background">{selected.title}</h2>
                <p className="text-sm text-on-surface-variant mt-0.5">{selected.provider}</p>
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
                    className="max-h-40 object-contain"
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
                  <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                    About this certification
                  </h3>
                  <p className="text-sm text-on-surface leading-relaxed whitespace-pre-line">
                    {selected.description}
                  </p>
                </div>
              )}

              {selected.topics && selected.topics.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Topics</h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.topics.map((t) => (
                      <span key={t} className="px-2.5 py-1 rounded-md text-xs font-medium bg-surface-container text-on-surface-variant">
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
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-on-primary font-bold shadow-sm hover:opacity-90 transition-opacity"
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
  clearAllFilters,
  activeFilterCount,
}: {
  isOpen: boolean
  onClose: () => void
  price: PriceFilter
  setPrice: (p: PriceFilter) => void
  levels: Set<Level>
  toggleLevel: (l: Level) => void
  durations: Set<DurationBucket>
  toggleDuration: (d: DurationBucket) => void
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
          md:static md:h-full md:translate-x-0 md:w-52 md:shadow-none md:border-r md:border-outline-variant md:z-auto
          overflow-y-auto p-4 shrink-0
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
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
        highlight ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'
      }`}
    >
      {label}
    </span>
  )
}
