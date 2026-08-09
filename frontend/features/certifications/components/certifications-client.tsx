'use client'

import { useState, useMemo, useEffect } from 'react'
import { CompanyLogo } from '@/features/opportunities/components/company-logo'

export interface Certification {
  id: string
  title: string
  provider: string
  provider_logo: string | null
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

/**
 * Certifications browser.
 *
 * Intentionally simpler than opportunity search: certifications have no
 * deadline, so there is nothing to sort by urgency and no freshness to signal.
 * A search box and a free/paid toggle are the only controls a student needs,
 * which is exactly the brief.
 */
export function CertificationsClient({ initial }: { initial: Certification[] }) {
  const [query, setQuery] = useState('')
  const [price, setPrice] = useState<PriceFilter>('all')
  const [selected, setSelected] = useState<Certification | null>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return initial.filter((c) => {
      if (price === 'free' && !c.is_free) return false
      if (price === 'paid' && c.is_free) return false
      if (!q) return true
      return (
        c.title.toLowerCase().includes(q) ||
        c.provider.toLowerCase().includes(q) ||
        (c.topics ?? []).some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [initial, query, price])

  // Close the detail panel on Escape, matching the rest of the app's dialogs.
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-container-lowest overflow-hidden">
      {/* Header: search + the two filters */}
      <div className="p-4 md:p-8 border-b border-outline-variant bg-surface shrink-0">
        <div className="max-w-5xl mx-auto w-full flex flex-col gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-on-background">Certifications</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Courses and certifications you can start any time — no deadlines.
            </p>
          </div>

          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
              search
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search certifications, providers or topics…"
              aria-label="Search certifications"
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-shadow"
            />
          </div>

          <div className="flex items-center gap-2" role="group" aria-label="Filter by price">
            {([
              { key: 'all', label: 'All' },
              { key: 'free', label: 'Free' },
              { key: 'paid', label: 'Paid' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPrice(key)}
                aria-pressed={price === key}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
                  price === key
                    ? 'bg-primary text-on-primary border-primary shadow-sm'
                    : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container'
                }`}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto text-sm text-on-surface-variant">
              {results.length.toLocaleString('en-IN')} {results.length === 1 ? 'certification' : 'certifications'}
            </span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-5xl mx-auto w-full flex flex-col gap-3 pb-24">
          {results.length === 0 ? (
            <div className="bg-surface border border-dashed border-outline-variant rounded-2xl p-12 flex flex-col items-center text-center">
              <span className="material-symbols-outlined text-outline text-[48px] mb-3">school</span>
              <h2 className="font-bold text-on-surface mb-1">No certifications found</h2>
              <p className="text-sm text-on-surface-variant max-w-md">
                Try a different search term, or clear the price filter.
              </p>
            </div>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="text-left bg-surface border border-outline-variant rounded-2xl p-5 shadow-sm hover:border-primary hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group"
              >
                <CompanyLogo
                  src={c.provider_logo}
                  name={c.provider}
                  alt={`${c.provider} logo`}
                  containerClassName="w-12 h-12 rounded-xl bg-surface-container-lowest flex items-center justify-center border border-outline-variant/60 overflow-hidden shrink-0"
                  imageClassName="w-8 h-8 object-contain"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-on-background truncate group-hover:text-primary transition-colors">
                    {c.title}
                  </h3>
                  <p className="text-sm text-on-surface-variant truncate">{c.provider}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                      c.is_free
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {c.is_free ? 'Free' : 'Paid'}
                  </span>
                  <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">
                    chevron_right
                  </span>
                </div>
              </button>
            ))
          )}
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
