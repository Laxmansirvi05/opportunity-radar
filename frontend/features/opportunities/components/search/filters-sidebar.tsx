'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchFilters } from '@/features/opportunities/hooks/use-search-filters'
import { useRecentSearches } from '@/features/opportunities/hooks/use-recent-searches'
import {
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_MODES,
  EXPERIENCE_LEVELS,
  FRESHNESS_OPTIONS,
  DEADLINE_OPTIONS,
} from '@/types/opportunity'

/**
 * Filters sidebar matching the Stitch design.
 * Desktop: static sidebar (w-72, border-r, always visible).
 * Mobile: slide-in drawer from left with overlay.
 */
interface FiltersSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function FiltersSidebar({ isOpen, onClose }: FiltersSidebarProps) {
  const { filters, toggleArrayFilter, setFilter, clearFilter, clearAllFilters } = useSearchFilters()

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-on-background/30 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 w-80 bg-surface shadow-2xl z-50 transform transition-transform duration-300 ease-in-out
          md:sticky md:top-[64px] md:h-[calc(100vh-64px)] md:translate-x-0 md:w-72 md:shadow-none md:border-r md:border-outline-variant md:z-auto
          overflow-y-auto p-6 shrink-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Recent Searches */}
        <RecentSearchesSection />

        {/* Divider */}
        <div className="border-b border-outline-variant mb-8" />

        {/* Freshness — above the Filters heading per Stitch design */}
        <FilterSection title="Freshness">
          <div className="flex flex-col gap-3">
            {FRESHNESS_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="freshness"
                  checked={filters.fresh === opt.value}
                  onChange={() => {
                    if (filters.fresh === opt.value) {
                      clearFilter('fresh')
                    } else {
                      setFilter('fresh', opt.value)
                    }
                  }}
                  className="w-4 h-4 border-outline text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-sm text-on-surface">{opt.label}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Filters Header */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-lg font-bold text-on-background">Filters</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={clearAllFilters}
              className="text-primary text-xs font-medium hover:underline cursor-pointer"
            >
              Clear all
            </button>
            {/* Mobile close button */}
            <button
              className="md:hidden text-on-surface-variant p-2 hover:bg-surface-container rounded-full transition-colors cursor-pointer"
              onClick={onClose}
              aria-label="Close filters"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Mode Filter */}
        <FilterSection title="Mode">
          <div className="flex flex-col gap-3">
            {OPPORTUNITY_MODES.map((mode) => (
              <label key={mode} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.mode?.includes(mode) ?? false}
                  onChange={() => toggleArrayFilter('mode', mode)}
                  className="w-4 h-4 rounded border-outline text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-sm text-on-surface">{mode}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Category Filter */}
        <FilterSection title="Category">
          <div className="flex flex-col gap-3">
            {OPPORTUNITY_CATEGORIES.map((cat) => (
              <label key={cat} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.category?.includes(cat) ?? false}
                  onChange={() => toggleArrayFilter('category', cat)}
                  className="w-4 h-4 rounded border-outline text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-sm text-on-surface">{cat}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Location Filter */}
        <FilterSection title="Location">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
              location_on
            </span>
            <input
              type="text"
              placeholder="City or region"
              value={filters.location ?? ''}
              onChange={(e) => setFilter('location', e.target.value || undefined)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-background text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
            />
          </div>
        </FilterSection>

        {/* Compensation Filter */}
        <FilterSection title="Compensation">
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.is_paid === true}
                onChange={() => {
                  if (filters.is_paid === true) {
                    clearFilter('is_paid')
                  } else {
                    setFilter('is_paid', true)
                  }
                }}
                className="w-4 h-4 rounded border-outline text-primary focus:ring-primary cursor-pointer"
              />
              <span className="text-sm text-on-surface">Paid</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.is_paid === false}
                onChange={() => {
                  if (filters.is_paid === false) {
                    clearFilter('is_paid')
                  } else {
                    setFilter('is_paid', false)
                  }
                }}
                className="w-4 h-4 rounded border-outline text-primary focus:ring-primary cursor-pointer"
              />
              <span className="text-sm text-on-surface">Free</span>
            </label>
          </div>
        </FilterSection>

        {/* Experience Filter */}
        <FilterSection title="Experience">
          <div className="flex flex-col gap-3">
            {EXPERIENCE_LEVELS.map((level) => (
              <label key={level} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.experience_level?.includes(level) ?? false}
                  onChange={() => toggleArrayFilter('experience_level', level)}
                  className="w-4 h-4 rounded border-outline text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-sm text-on-surface">{level}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Skills Filter */}
        <FilterSection title="Skills">
          <SkillsFilter />
        </FilterSection>

        {/* Company Filter */}
        <FilterSection title="Company">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
              business
            </span>
            <input
              type="text"
              placeholder="Search companies..."
              value={filters.company ?? ''}
              onChange={(e) => setFilter('company', e.target.value || undefined)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-background text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
            />
          </div>
        </FilterSection>

        {/* Deadline Filter */}
        <FilterSection title="Deadline">
          <div className="space-y-3">
            {DEADLINE_OPTIONS.map((opt) => {
              const isSelected = filters.deadline === opt.value
              return (
                <label
                  key={opt.value}
                  className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all group ${isSelected
                    ? 'border-2 border-primary bg-primary-fixed-dim/5 shadow-sm'
                    : 'border border-outline-variant hover:border-primary/50 bg-surface'
                    }`}
                >
                  <span
                    className={`text-sm ${isSelected ? 'text-primary font-semibold' : 'text-on-surface'
                      }`}
                  >
                    {opt.label}
                  </span>
                  <input
                    type="radio"
                    name="deadline"
                    checked={isSelected}
                    onChange={() => {
                      if (isSelected) {
                        clearFilter('deadline')
                      } else {
                        setFilter('deadline', opt.value)
                      }
                    }}
                    className="text-primary focus:ring-primary border-outline cursor-pointer"
                  />
                </label>
              )
            })}
          </div>
        </FilterSection>
      </aside>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

function FilterSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-8">
      <h3 className="text-[11px] font-semibold text-on-surface-variant mb-4 uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </div>
  )
}

function SkillsFilter() {
  const { filters, toggleArrayFilter } = useSearchFilters()
  const [skillInput, setSkillInput] = useState('')
  const currentTags = filters.tags ?? []

  const handleAddSkill = () => {
    const trimmed = skillInput.trim()
    if (trimmed && !currentTags.includes(trimmed)) {
      toggleArrayFilter('tags', trimmed)
      setSkillInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddSkill()
    }
  }

  return (
    <>
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
          search
        </span>
        <input
          type="text"
          placeholder="Search skills..."
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-background text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
        />
      </div>
      {currentTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {currentTags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 bg-surface-container rounded text-[11px] font-semibold flex items-center gap-1"
            >
              {tag}
              <button
                onClick={() => toggleArrayFilter('tags', tag)}
                className="cursor-pointer"
                aria-label={`Remove ${tag} skill filter`}
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  )
}

function RecentSearchesSection() {
  const { recentSearches, clearRecentSearches } = useRecentSearches()
  const router = useRouter()

  if (recentSearches.length === 0) return null

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
          Recent Searches
        </h3>
        <button
          onClick={clearRecentSearches}
          className="text-primary text-[11px] font-medium hover:underline cursor-pointer"
        >
          Clear
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {recentSearches.map((query, i) => (
          <button
            key={`${query}-${i}`}
            onClick={() => router.replace(`/search?q=${encodeURIComponent(query)}`)}
            className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer text-left"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            <span className="text-sm">{query}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
