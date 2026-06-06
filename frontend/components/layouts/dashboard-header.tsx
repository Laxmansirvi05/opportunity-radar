'use client'

import { User } from '@supabase/supabase-js'
import Link from 'next/link'

interface DashboardHeaderProps {
  user: User
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const initial = user.email ? user.email.charAt(0).toUpperCase() : 'U'

  return (
    <header className="h-16 bg-surface border-b border-outline-variant flex items-center justify-between px-gutter sticky top-0 z-40">
      <div className="flex-1" />
      <div className="flex items-center gap-md">
        {/* Notifications icon */}
        <button
          className="w-10 h-10 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          aria-label="Notifications"
        >
          <span className="material-symbols-outlined">notifications</span>
        </button>
        {/* User avatar with email tooltip */}
        <Link
          href="/profile"
          className="flex items-center gap-sm px-sm py-xs bg-surface-container rounded-xl hover:bg-surface-container-high transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-semibold text-sm select-none">
            {initial}
          </div>
          <span className="font-label-md text-label-md text-on-surface font-semibold hidden sm:block max-w-[140px] truncate">
            {user.email}
          </span>
        </Link>
      </div>
    </header>
  )
}
