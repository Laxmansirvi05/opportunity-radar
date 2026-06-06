import { logoutAction } from '@/features/auth/actions/auth-actions'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'

interface DashboardSidebarProps {
  user: User
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const initial = user.email ? user.email.charAt(0).toUpperCase() : 'U'
  const displayName = user.user_metadata?.full_name ?? user.email ?? 'Student'

  return (
    <aside className="hidden lg:flex flex-col h-screen p-md overflow-y-auto bg-surface border-r border-outline-variant w-64 sticky top-0 z-40 shrink-0">
      {/* Logo */}
      <div className="mb-xl flex items-center gap-sm px-sm pt-sm">
        <div className="w-10 h-10 bg-primary-container text-on-primary-container rounded-xl flex items-center justify-center">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
        </div>
        <div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-primary">Opportunity Radar</h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant">Student Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-sm">
        <Link
          href="/"
          className="flex items-center gap-md px-md py-sm rounded-xl text-on-surface-variant hover:bg-surface-container transition-all"
        >
          <span className="material-symbols-outlined">explore</span>
          <span className="font-label-md text-label-md">Hub</span>
        </Link>
        <Link
          href="/dashboard"
          className="flex items-center gap-md px-md py-sm rounded-xl bg-primary-container text-on-primary-container transition-all shadow-sm font-medium"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
          <span className="font-label-md text-label-md font-semibold">Command Center</span>
        </Link>
        <Link
          href="/profile"
          className="flex items-center gap-md px-md py-sm rounded-xl text-on-surface-variant hover:bg-surface-container transition-all"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-md text-label-md">Profile</span>
        </Link>
      </nav>

      {/* Bottom section */}
      <div className="mt-auto pt-lg border-t border-outline-variant">
        <div className="flex flex-col gap-xs">
          <Link
            href="#"
            className="flex items-center gap-md px-md py-sm rounded-xl text-on-surface-variant hover:bg-surface-container transition-all"
          >
            <span className="material-symbols-outlined">help</span>
            <span className="font-label-md text-label-md">Support</span>
          </Link>
          {/* Sign Out — uses Server Action directly */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-md px-md py-sm rounded-xl text-on-surface-variant hover:bg-surface-container transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="font-label-md text-label-md">Sign Out</span>
            </button>
          </form>
        </div>
        {/* User info chip */}
        <div className="mt-md flex items-center gap-sm px-sm py-xs bg-surface-container rounded-xl">
          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-semibold text-sm shrink-0">
            {initial}
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
