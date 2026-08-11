'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden bg-surface border-t border-outline-variant fixed bottom-0 left-0 w-full z-50 pb-safe premium-shadow">
      <ul className="flex justify-around items-center h-16 px-4">
        <li>
          <Link
            href="/hub"
            aria-label="Hub"
            className={`flex flex-col items-center justify-center text-on-surface-variant w-16 hover:text-primary transition-colors ${pathname === '/hub' ? 'text-primary border-t-2 border-primary pt-1' : ''}`}
          >
            <span className={`material-symbols-outlined mb-1 ${pathname === '/hub' ? 'filled' : ''}`}>explore</span>
            <span className={`font-label-sm ${pathname === '/hub' ? 'font-bold' : ''}`}>Hub</span>
          </Link>
        </li>
        <li>
          <Link
            href="/search"
            aria-label="Search"
            className={`flex flex-col items-center justify-center text-on-surface-variant w-16 hover:text-primary transition-colors ${pathname === '/search' ? 'text-primary border-t-2 border-primary pt-1' : ''}`}
          >
            <span className={`material-symbols-outlined mb-1 ${pathname === '/search' ? 'filled' : ''}`}>search</span>
            <span className={`font-label-sm ${pathname === '/search' ? 'font-bold' : ''}`}>Search</span>
          </Link>
        </li>
        <li>
          <Link
            href="/tracker"
            aria-label="Tracker"
            className={`flex flex-col items-center justify-center text-on-surface-variant w-16 hover:text-primary transition-colors ${pathname === '/tracker' ? 'text-primary border-t-2 border-primary pt-1' : ''}`}
          >
            <span className={`material-symbols-outlined mb-1 ${pathname === '/tracker' ? 'filled' : ''}`}>assignment_turned_in</span>
            <span className={`font-label-sm ${pathname === '/tracker' ? 'font-bold' : ''}`}>Tracker</span>
          </Link>
        </li>
        <li>
          <Link
            href="/dashboard"
            aria-label="Command Center"
            className={`flex flex-col items-center justify-center text-on-surface-variant w-16 hover:text-primary transition-colors ${pathname === '/dashboard' ? 'text-primary border-t-2 border-primary pt-1' : ''}`}
          >
            <span className={`material-symbols-outlined mb-1 ${pathname === '/dashboard' ? 'filled' : ''}`}>dashboard</span>
            <span className={`font-label-sm ${pathname === '/dashboard' ? 'font-bold' : ''}`}>Command</span>
          </Link>
        </li>
        <li>
          <Link
            href="/assistant"
            aria-label="AI Assistant"
            className={`flex flex-col items-center justify-center text-on-surface-variant w-16 hover:text-primary transition-colors ${pathname === '/assistant' ? 'text-primary border-t-2 border-primary pt-1' : ''}`}
          >
            <span className={`material-symbols-outlined mb-1 ${pathname === '/assistant' ? 'filled' : ''}`}>smart_toy</span>
            <span className={`font-label-sm ${pathname === '/assistant' ? 'font-bold' : ''}`}>Assistant</span>
          </Link>
        </li>
        <li>
          <Link
            href="/resume"
            aria-label="Resume"
            className={`flex flex-col items-center justify-center text-on-surface-variant w-16 hover:text-primary transition-colors ${pathname === '/resume' ? 'text-primary border-t-2 border-primary pt-1' : ''}`}
          >
            <span className={`material-symbols-outlined mb-1 ${pathname === '/resume' ? 'filled' : ''}`}>description</span>
            <span className={`font-label-sm ${pathname === '/resume' ? 'font-bold' : ''}`}>Resume</span>
          </Link>
        </li>
      </ul>
    </nav>
  )
}
