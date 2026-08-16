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

interface NavItem {
  href: string
  icon: string
  label: string
}

/**
 * Navigation, grouped by what the student is actually doing.
 *
 * Ten flat items read as a list to scan; three short groups read as a place
 * to navigate. The grouping is the only structural change — every destination
 * that existed before still exists, at the same href.
 */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Discover',
    items: [
      { href: '/hub', icon: 'explore', label: 'Hub' },
      { href: '/search', icon: 'search', label: 'Search' },
      { href: '/certifications', icon: 'school', label: 'Certifications' },
    ],
  },
  {
    label: 'Prepare',
    items: [
      { href: '/resume', icon: 'description', label: 'Resume' },
      { href: '/interview', icon: 'record_voice_over', label: 'Mock Interview' },
      { href: '/assistant', icon: 'smart_toy', label: 'AI Assistant' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/tracker', icon: 'assignment_turned_in', label: 'Tracker' },
      { href: '/notes', icon: 'note_stack', label: 'Notes' },
      { href: '/dashboard', icon: 'dashboard', label: 'Command Center' },
      { href: '/profile', icon: 'person', label: 'Profile' },
    ],
  },
]

const SECONDARY_ITEMS: NavItem[] = [
  { href: '/settings', icon: 'settings', label: 'Settings' },
  { href: '/support', icon: 'help', label: 'Support' },
]

/**
 * One navigation row.
 *
 * The depth is carried by the icon tile rather than the whole row: a row that
 * tilts drags its text out of alignment with its neighbours, which reads as
 * wobble. Lifting and rotating a small square instead keeps the type on its
 * baseline while still giving the row a physical response — and the tile is
 * the part the eye tracks down the list anyway.
 *
 * Only transform, opacity and shadow animate, so hovering never triggers
 * layout on a component that renders on every protected page.
 */
function NavRow({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      className={`sidebar-row group/row relative flex items-center gap-3 rounded-xl px-2 py-1.5 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary ${
        isActive ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {/* The active marker is a rail on the left edge, so switching pages
          reads as the marker moving down a track rather than a whole block
          of colour appearing somewhere new. */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-all duration-300 ease-note ${
          isActive ? 'h-6 opacity-100' : 'h-0 opacity-0'
        }`}
      />

      <span
        aria-hidden="true"
        className={`sidebar-tile grid size-9 shrink-0 place-items-center rounded-[10px] transition-all duration-300 ease-note ${
          isActive
            ? 'bg-primary text-on-primary shadow-[0_6px_14px_-4px_var(--color-primary)]'
            : 'bg-surface-container text-on-surface-variant group-hover/row:bg-surface-container-high group-hover/row:text-on-surface'
        }`}
      >
        <span
          className="material-symbols-outlined text-[19px]"
          style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          {item.icon}
        </span>
      </span>

      <span className={`font-label-md text-label-md truncate ${isActive ? 'font-semibold' : ''}`}>
        {item.label}
      </span>
    </Link>
  )
}

export function DashboardSidebar({ user, avatarUrl, userName }: DashboardSidebarProps) {
  const pathname = usePathname()
  const displayName = userName ?? user.user_metadata?.full_name ?? user.email ?? 'Student'
  const initial = displayName ? displayName.charAt(0).toUpperCase() : 'U'

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <aside
      // hidden md:flex, not lg — this is the UI-04 fix. The mobile chrome
      // disappears at md, so the sidebar has to take over at exactly that
      // width or the 768–1023px range has no navigation at all.
      className="sidebar-3d hidden md:flex flex-col h-screen w-64 shrink-0 sticky top-0 z-40 overflow-y-auto overflow-x-hidden border-r border-outline-variant bg-surface"
    >
      <div className="flex flex-col gap-1 px-3 pb-3 pt-5">
        <Link
          href="/dashboard"
          className="group/logo flex items-center gap-2.5 rounded-xl px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span
            aria-hidden="true"
            className="sidebar-logo grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-on-primary shadow-[0_8px_18px_-6px_var(--color-primary)] transition-transform duration-500 ease-note"
          >
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              radar
            </span>
          </span>
          <span className="min-w-0">
            <span className="block font-title-md text-title-md font-bold leading-tight text-on-surface truncate">
              Opportunity Radar
            </span>
            <span className="block font-label-sm text-label-sm text-on-surface-variant">Student Portal</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 pb-2" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="mb-1 px-2 font-label-sm text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant/60">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavRow key={item.href} item={item} isActive={isActive(item.href)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto px-3 pb-4">
        <Link
          href="/ai-search"
          className="sidebar-cta group/cta mb-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 font-label-md text-label-md font-semibold text-on-primary outline-none transition-transform duration-300 ease-note focus-visible:ring-2 focus-visible:ring-primary"
          style={{
            // One hue, two depths. An earlier attempt ran primary -> tertiary,
            // which in this theme is a red and made the button read blue-to-maroon
            // — loud, and unrelated to anything else on the rail.
            background:
              'linear-gradient(135deg, color-mix(in oklab, var(--color-primary) 88%, white) 0%, color-mix(in oklab, var(--color-primary) 82%, black) 100%)',
            boxShadow: '0 10px 22px -10px var(--color-primary)',
          }}
        >
          <span className="material-symbols-outlined text-[18px] transition-transform duration-500 ease-note group-hover/cta:rotate-[18deg]">
            auto_awesome
          </span>
          AI Search
        </Link>

        <div className="flex flex-col gap-0.5 border-t border-outline-variant pt-3">
          {SECONDARY_ITEMS.map((item) => (
            <NavRow key={item.href} item={item} isActive={isActive(item.href)} />
          ))}

          {/* Sign Out — the same server action the mobile header uses. */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="sidebar-row group/row relative flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-on-surface-variant outline-none transition-colors duration-200 hover:text-error focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            >
              <span
                aria-hidden="true"
                className="sidebar-tile grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface-container text-on-surface-variant transition-all duration-300 ease-note group-hover/row:bg-error-container group-hover/row:text-on-error-container"
              >
                <span className="material-symbols-outlined text-[19px]">logout</span>
              </span>
              <span className="font-label-md text-label-md">Sign Out</span>
            </button>
          </form>
        </div>

        <Link
          href="/profile"
          className="sidebar-user mt-3 flex items-center gap-2.5 rounded-xl border border-outline-variant bg-surface-container-low p-2 outline-none transition-all duration-300 ease-note hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-container font-semibold text-sm text-on-primary-container">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill className="object-cover" sizes="36px" />
            ) : (
              initial
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-label-md text-label-md font-semibold text-on-surface">{displayName}</span>
            <span className="truncate font-label-sm text-label-sm text-on-surface-variant">{user.email}</span>
          </span>
        </Link>
      </div>
    </aside>
  )
}
