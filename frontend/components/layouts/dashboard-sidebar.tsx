'use client'

import { logoutAction } from '@/features/auth/actions/auth-actions'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User } from '@supabase/supabase-js'

import Image from 'next/image'

interface DashboardSidebarProps {
  user: User
  avatarUrl?: string | null
  userName?: string | null
}

// Navigation items matching the Stitch design
const NAV_ITEMS = [
  { href: '/hub', icon: 'explore', label: 'Hub' },
  { href: '/search', icon: 'search', label: 'Search' },
  { href: '/tracker', icon: 'assignment_turned_in', label: 'Tracker' },
  { href: '/resume', icon: 'description', label: 'Resume' },
  { href: '/interview', icon: 'record_voice_over', label: 'Mock Interview' },
  { href: '/certifications', icon: 'school', label: 'Certifications' },
  { href: '/dashboard', icon: 'dashboard', label: 'Command Center' },
  { href: '/assistant', icon: 'smart_toy', label: 'AI Assistant' },
  { href: '/profile', icon: 'person', label: 'Profile' },
]

export function DashboardSidebar({ user, avatarUrl, userName }: DashboardSidebarProps) {
  const pathname = usePathname()
  const displayName = userName ?? user.user_metadata?.full_name ?? user.email ?? 'Student'
  const initial = displayName ? displayName.charAt(0).toUpperCase() : 'U'

  return (
    <aside className="hidden md:flex flex-col h-screen p-4 overflow-y-auto bg-surface border-r border-outline-variant w-64 sticky top-0 z-40 shrink-0">
      {/* Logo */}
      <div className="mb-10 flex items-center gap-2 px-2 pt-2">
        <div className="w-10 h-10 bg-primary-container text-on-primary-container rounded-xl flex items-center justify-center">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
        </div>
        <div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-primary">Opportunity Radar</h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant">Student Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive
                  ? 'flex items-center gap-4 px-4 py-2 rounded-xl bg-primary-container text-on-primary-container transition-all shadow-sm font-medium'
                  : 'flex items-center gap-4 px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-all'
              }
            >
              <span
                className="material-symbols-outlined"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className={`font-label-md text-label-md ${isActive ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto pt-6 border-t border-outline-variant">
        <Link
          href="/ai-search"
          className="flex items-center justify-center gap-2 w-full bg-primary text-on-primary font-label-md text-label-md font-semibold py-2 rounded-xl hover:opacity-90 transition-opacity mb-4 shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          AI Search
        </Link>
        <div className="flex flex-col gap-1">
          <Link
            href="/settings"
            className="flex items-center gap-4 px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-all"
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="font-label-md text-label-md">Settings</span>
          </Link>
          <Link
            href="/support"
            className="flex items-center gap-4 px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-all"
          >
            <span className="material-symbols-outlined">help</span>
            <span className="font-label-md text-label-md">Support</span>
          </Link>
          {/* Sign Out — uses Server Action directly */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-4 px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="font-label-md text-label-md">Sign Out</span>
            </button>
          </form>
        </div>
        {/* User info chip */}
        <div className="mt-4 flex items-center gap-2 px-2 py-1 bg-surface-container rounded-xl">
          <div className="relative w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-semibold text-sm shrink-0 overflow-hidden border-2 border-surface-container-lowest">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Profile" fill className="object-cover" sizes="40px" />
            ) : (
              initial
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-md text-label-md text-on-surface font-semibold truncate">{displayName}</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant truncate">{user.email}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
