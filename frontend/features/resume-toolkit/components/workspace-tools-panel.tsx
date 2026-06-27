'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TOOLS = [
  {
    id: 'builder',
    label: 'Build from Scratch',
    description: 'Guided workflow to create a modern, professional resume.',
    icon: 'architecture',
    iconColor: 'text-primary',
    iconBg: 'bg-primary-fixed',
    href: '/resume/builder/new',
    match: '/resume/builder'
  },
  {
    id: 'extract',
    label: 'Extract & Edit',
    description: 'Import existing documents and convert to editable format.',
    icon: 'post_add',
    iconColor: 'text-secondary-on-container', // Adjusting for teal
    iconBg: 'bg-secondary-container',
    href: '/resume/upload',
    match: '/resume/upload'
  },
  {
    id: 'ats',
    label: 'ATS Score Checker',
    description: 'Instant feedback on how well your resume reads by robots.',
    icon: 'grading',
    iconColor: 'text-tertiary',
    iconBg: 'bg-tertiary-fixed',
    href: '/resume/ats',
    match: '/resume/ats'
  },
  {
    id: 'copilot',
    label: 'AI Optimizer',
    description: 'Smart enhancement suggestions based on your target role.',
    icon: 'auto_fix_high',
    iconColor: 'text-primary',
    iconBg: 'bg-primary-fixed',
    href: '/resume/copilot',
    match: '/resume/copilot'
  }
]

export function WorkspaceToolsPanel() {
  const pathname = usePathname()

  return (
    <div className="w-[300px] shrink-0 border-r border-outline-variant bg-background flex flex-col h-full overflow-y-auto p-6 hidden lg:flex">
      <h2 className="text-[18px] leading-[1.4] font-semibold text-on-background mb-6 tracking-tight">Workspace Tools</h2>
      
      <div className="space-y-4">
        {TOOLS.map((tool) => {
          const isActive = pathname.startsWith(tool.match)
          
          return (
            <Link key={tool.id} href={tool.href} className="block outline-none group">
              <div className={cn(
                'p-4 rounded-lg border transition-colors duration-150',
                isActive 
                  ? 'border-primary bg-primary text-on-primary' 
                  : 'border-outline-variant bg-surface-container-lowest hover:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
              )}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                    isActive ? 'bg-white/20' : tool.iconBg
                  )}>
                    <span className={cn(
                      'material-symbols-outlined text-[24px]',
                      isActive ? 'text-on-primary' : tool.iconColor
                    )}>
                      {tool.icon}
                    </span>
                  </div>
                  <h3 className={cn(
                    'text-[14px] leading-[1.5] font-semibold',
                    isActive ? 'text-on-primary' : 'text-on-background'
                  )}>
                    {tool.label}
                  </h3>
                </div>
                <p className={cn(
                  'text-[12px] leading-[1.5] font-medium',
                  isActive ? 'text-primary-fixed' : 'text-on-surface-variant'
                )}>
                  {tool.description}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
