'use client'

import { cn } from '@/lib/utils'
import { SECTION_CONFIG, type SectionKey } from './section-editor'

interface SectionsPanelProps {
  activeSection: SectionKey
  onSectionSelect: (key: SectionKey) => void
  sectionCounts: Record<string, number>
}

export function SectionsPanel({ activeSection, onSectionSelect, sectionCounts }: SectionsPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-outline-variant shrink-0">
        <h2 className="text-sm font-semibold text-on-background">Sections</h2>
      </div>
      <nav className="flex-1 overflow-y-auto py-1">
        {SECTION_CONFIG.map((section) => {
          const isActive = activeSection === section.key
          const count = sectionCounts[section.key] ?? 0
          return (
            <button
              key={section.key}
              onClick={() => onSectionSelect(section.key)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                isActive
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:bg-surface-container'
              )}
            >
              <span className="material-symbols-outlined text-lg">{section.icon}</span>
              <span className="flex-1 truncate">{section.label}</span>
              {count > 0 && (
                <span className={cn(
                  'text-[10px] rounded-full px-1.5 min-w-[18px] text-center',
                  isActive ? 'bg-on-primary-container/15 text-on-primary-container' : 'bg-surface-container text-on-surface-variant'
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
