'use client'

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface SettingsPanelProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function SettingsPanel({ isCollapsed, onToggleCollapse }: SettingsPanelProps) {
  if (isCollapsed) {
    return (
      <div className="h-full border-l border-outline-variant bg-surface flex flex-col items-center py-4 shrink-0 w-12">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-on-surface-variant hover:text-primary transition-colors"
          onClick={onToggleCollapse}
          title="Expand Settings"
        >
          <span className="material-symbols-outlined text-sm">first_page</span>
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full border-l border-outline-variant bg-surface flex flex-col w-72 shrink-0">
      <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-on-background">Resume Settings</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-on-surface-variant hover:text-primary transition-colors"
          onClick={onToggleCollapse}
          title="Collapse Settings"
        >
          <span className="material-symbols-outlined text-sm">last_page</span>
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Placeholder: Resume Health */}
        <Card className="shadow-none border-outline-variant">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">health_metrics</span>
              Resume Health
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border-2 border-outline flex items-center justify-center text-xs font-semibold text-on-surface-variant">
                --
              </div>
              <p className="text-xs text-on-surface-variant">
                Check ATS score to unlock health metrics.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Placeholder: Templates */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Templates</h3>
          <Card className="shadow-none border-dashed bg-surface-container-lowest">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
              <span className="material-symbols-outlined text-on-surface-variant text-2xl">grid_view</span>
              <p className="text-xs text-on-surface-variant">Template selection coming in Phase 2B</p>
            </CardContent>
          </Card>
        </div>

        {/* Placeholder: Design */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Design</h3>
          <Card className="shadow-none border-dashed bg-surface-container-lowest">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
              <span className="material-symbols-outlined text-on-surface-variant text-2xl">palette</span>
              <p className="text-xs text-on-surface-variant">Theme & Typography settings coming in Phase 2B</p>
            </CardContent>
          </Card>
        </div>

        {/* Placeholder: Checklist */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Checklist</h3>
          <div className="space-y-2">
            {[
              'Add contact information',
              'Write a professional summary',
              'Include at least one experience',
              'Add your education',
              'List relevant skills'
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="material-symbols-outlined text-sm text-outline shrink-0 mt-0.5">check_circle</span>
                <span className="text-xs text-on-surface-variant leading-tight">{item}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
