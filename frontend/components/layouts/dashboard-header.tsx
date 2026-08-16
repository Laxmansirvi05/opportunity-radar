'use client'

import { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { logoutAction } from '@/features/auth/actions/auth-actions'

interface DashboardHeaderProps {
  user: User
  avatarUrl?: string | null
  userName?: string | null
}

import Image from 'next/image'

// The bottom tab bar only has room for 6 destinations (Hub/Search/Tracker/
// Command/Assistant/Resume) — everything else the desktop sidebar links to
// has to live somewhere reachable below the md breakpoint too, or it's
// simply unreachable on a phone. This is that "everything else" menu.
const MORE_NAV_ITEMS = [
  { href: '/interview', icon: 'record_voice_over', label: 'Mock Interview' },
  { href: '/certifications', icon: 'school', label: 'Certifications' },
  { href: '/ai-search', icon: 'auto_awesome', label: 'AI Search' },
  { href: '/settings', icon: 'settings', label: 'Settings' },
  { href: '/support', icon: 'help', label: 'Support' },
]

export function DashboardHeader({ user, avatarUrl, userName }: DashboardHeaderProps) {
  const displayName = userName ?? user.user_metadata?.full_name ?? user.email ?? 'Student'
  const initial = displayName ? displayName.charAt(0).toUpperCase() : 'U'
  const [unreadCount, setUnreadCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  const fetchUnread = async () => {
    try {
      const res = await fetch('/api/notifications/unread')
      const json = await res.json()
      if (typeof json.unreadCount === 'number') {
        setUnreadCount(json.unreadCount)
      }
    } catch (e) {
      // Ignore background fetch error
    }
  }

  useEffect(() => {
    fetchUnread()
    const handleUpdate = () => fetchUnread()
    window.addEventListener('notifications-updated', handleUpdate)
    return () => window.removeEventListener('notifications-updated', handleUpdate)
  }, [])

  // A route change always means a real navigation happened (either from this
  // menu or anything else) — closing here catches every case in one place
  // instead of wiring an onClick to every single link. This is synchronizing
  // local UI state with an external signal (the router), not deriving
  // render output, which is what this rule is meant to catch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false)
  }, [pathname])

  return (
    <nav className="md:hidden bg-surface text-primary border-b border-outline-variant flex justify-between items-center px-6 h-16 w-full sticky top-0 z-50 premium-shadow">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex items-center justify-center w-8 h-8 -ml-2 text-primary"
        >
          <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
        </button>
        <div className="font-headline-sm text-headline-sm font-bold text-primary">Opportunity Radar</div>
      </div>
      <div className="flex gap-4 text-primary items-center">
        <Link href="/notifications" aria-label="Notifications" className="relative flex items-center justify-center w-8 h-8">
          <span className="material-symbols-outlined cursor-pointer hover:text-primary-fixed-dim transition-colors duration-100">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-error text-on-error rounded-full text-[10px] font-bold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        <Link href="/profile" aria-label="Profile">
          <div className="relative w-8 h-8 rounded-full border border-outline-variant bg-primary-container text-on-primary-container flex items-center justify-center font-semibold text-sm select-none overflow-hidden">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Profile" fill className="object-cover" sizes="32px" />
            ) : (
              initial
            )}
          </div>
        </Link>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 top-16 bg-on-background/30 backdrop-blur-sm z-40"
          />
          <div className="absolute top-16 left-0 w-full bg-surface border-b border-outline-variant shadow-lg z-40 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex flex-col gap-1 p-3">
              {MORE_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container transition-all"
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span className="font-label-md text-label-md">{item.label}</span>
                </Link>
              ))}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container transition-all text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined">logout</span>
                  <span className="font-label-md text-label-md">Sign Out</span>
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </nav>
  )
}
