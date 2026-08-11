'use client'

import { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useState, useEffect } from 'react'

interface DashboardHeaderProps {
  user: User
  avatarUrl?: string | null
  userName?: string | null
}

import Image from 'next/image'

export function DashboardHeader({ user, avatarUrl, userName }: DashboardHeaderProps) {
  const displayName = userName ?? user.user_metadata?.full_name ?? user.email ?? 'Student'
  const initial = displayName ? displayName.charAt(0).toUpperCase() : 'U'
  const [unreadCount, setUnreadCount] = useState(0)

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

  return (
    <nav className="md:hidden bg-surface text-primary border-b border-outline-variant flex justify-between items-center px-6 h-16 w-full sticky top-0 z-50 premium-shadow">
      <div className="font-headline-sm text-headline-sm font-bold text-primary">Opportunity Radar</div>
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
    </nav>
  )
}
