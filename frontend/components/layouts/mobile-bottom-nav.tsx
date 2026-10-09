'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden bg-surface border-t border-outline-variant fixed bottom-0 left-0 w-full z-50 pb-safe premium-shadow">
      {/* Six items share the width equally. Fixed 64px columns needed 384px plus
          padding, which is wider than a 375px phone, so labels ran into each
          other ("TrackerCommand") and the last item was cut off. */}
      <ul className="flex items-stretch h-16 px-1">
        <li className="flex-1 min-w-0">
          <Link
            href="/hub"
            aria-label="Hub"
            className={`flex flex-col items-center justify-center text-on-surface-variant w-full h-full hover:text-primary transition-colors ${pathname === '/hub' ? 'text-primary border-t-2 border-primary pt-1' : ''}`}
          >
            <span className={`material-symbols-outlined mb-1 ${pathname === '/hub' ? 'filled' : ''}`}>explore</span>
            <span className={`text-[11px] leading-tight max-w-full truncate ${pathname === '/hub' ? 'font-bold' : ''}`}>Hub</span>
          </Link>
        </li>
        <li className="flex-1 min-w-0">
          <Link
            href="/search"
            aria-label="Search"
            className={`flex flex-col items-center justify-center text-on-surface-variant w-full h-full hover:text-primary transition-colors ${pathname === '/search' ? 'text-primary border-t-2 border-primary pt-1' : ''}`}
          >
            <span className={`material-symbols-outlined mb-1 ${pathname === '/search' ? 'filled' : ''}`}>search</span>
            <span className={`text-[11px] leading-tight max-w-full truncate ${pathname === '/search' ? 'font-bold' : ''}`}>Search</span>
          </Link>
        </li>
        <li className="flex-1 min-w-0">
          <Link
            href="/tracker"
            aria-label="Tracker"
            className={`flex flex-col items-center justify-center text-on-surface-variant w-full h-full hover:text-primary transition-colors ${pathname === '/tracker' ? 'text-primary border-t-2 border-primary pt-1' : ''}`}
          >
            <span className={`material-symbols-outlined mb-1 ${pathname === '/tracker' ? 'filled' : ''}`}>assignment_turned_in</span>
            <span className={`text-[11px] leading-tight max-w-full truncate ${pathname === '/tracker' ? 'font-bold' : ''}`}>Tracker</span>
          </Link>
        </li>
        <li className="flex-1 min-w-0">
          <Link
            href="/dashboard"
            aria-label="Command Center"
            className={`flex flex-col items-center justify-center text-on-surface-variant w-full h-full hover:text-primary transition-colors ${pathname === '/dashboard' ? 'text-primary border-t-2 border-primary pt-1' : ''}`}
          >
            <span className={`material-symbols-outlined mb-1 ${pathname === '/dashboard' ? 'filled' : ''}`}>dashboard</span>
            <span className={`text-[11px] leading-tight max-w-full truncate ${pathname === '/dashboard' ? 'font-bold' : ''}`}>Home</span>
          </Link>
        </li>
        <li className="flex-1 min-w-0">
          <Link
            href="/assistant"
            aria-label="AI Assistant"
            className={`flex flex-col items-center justify-center text-on-surface-variant w-full h-full hover:text-primary transition-colors ${pathname === '/assistant' ? 'text-primary border-t-2 border-primary pt-1' : ''}`}
          >
            <span className={`material-symbols-outlined mb-1 ${pathname === '/assistant' ? 'filled' : ''}`}>smart_toy</span>
            <span className={`text-[11px] leading-tight max-w-full truncate ${pathname === '/assistant' ? 'font-bold' : ''}`}>Assistant</span>
          </Link>
        </li>
        <li className="flex-1 min-w-0">
          <Link
            href="/resume"
            aria-label="Resume"
            className={`flex flex-col items-center justify-center text-on-surface-variant w-full h-full hover:text-primary transition-colors ${pathname === '/resume' ? 'text-primary border-t-2 border-primary pt-1' : ''}`}
          >
            <span className={`material-symbols-outlined mb-1 ${pathname === '/resume' ? 'filled' : ''}`}>description</span>
            <span className={`text-[11px] leading-tight max-w-full truncate ${pathname === '/resume' ? 'font-bold' : ''}`}>Resume</span>
          </Link>
        </li>
      </ul>
    </nav>
  )
}
