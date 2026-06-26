'use client'

import { User } from '@supabase/supabase-js'
import Link from 'next/link'

interface DashboardHeaderProps {
  user: User
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const initial = user.email ? user.email.charAt(0).toUpperCase() : 'U'

  return (
    <nav className="md:hidden bg-surface text-primary border-b border-outline-variant flex justify-between items-center px-lg h-16 w-full sticky top-0 z-50 premium-shadow">
      <div className="font-headline-sm text-headline-sm font-bold text-primary">Opportunity Radar</div>
      <div className="flex gap-md text-primary items-center">
        <Link href="/notifications" aria-label="Notifications">
          <span className="material-symbols-outlined cursor-pointer hover:text-primary-fixed-dim transition-colors duration-100">notifications</span>
        </Link>
        <Link href="/profile" aria-label="Profile">
          <div className="w-8 h-8 rounded-full border border-outline-variant bg-primary-container text-on-primary-container flex items-center justify-center font-semibold text-sm select-none">
            {initial}
          </div>
        </Link>
      </div>
    </nav>
  )
}
