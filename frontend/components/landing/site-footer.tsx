import { Radar } from 'lucide-react'

const COLS = [
  {
    title: 'Product',
    links: [
      { name: 'Features', href: '#' },
      { name: 'How It Works', href: '#' },
      { name: 'Companies', href: '#' },
      { name: 'Dashboard', href: '/hub' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { name: 'Search Opportunities', href: '/search' },
      { name: 'Tracker', href: '/tracker' },
      { name: 'Command Center', href: '/command-center' },
      { name: 'Profile', href: '/profile' },
    ],
  },
  {
    title: 'Company',
    links: [
      { name: 'About', href: '#' },
      { name: 'Contact', href: '#' },
      { name: 'Privacy Policy', href: '#' },
      { name: 'Terms of Service', href: '#' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border bg-card/30 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-5 lg:col-span-2 w-full max-w-[384px]">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
                <Radar className="size-5 text-primary" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-foreground">
                Opportunity Radar
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The smartest way to discover internships, jobs, hackathons,
              scholarships, workshops, and competitions from a single intelligent
              opportunity radar.
            </p>
            <div className="mt-2 flex items-center gap-3">
              <a
                href="REPLACE_WITH_MY_GITHUB"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="flex size-9 items-center justify-center rounded-lg border border-border bg-transparent text-muted-foreground transition-all duration-300 hover:border-primary/50 hover:bg-primary/10 hover:text-primary hover:shadow-md hover:shadow-primary/20"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.57 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.34-1.73-1.34-1.73-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.21 1.84 1.21 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.58-2.67-.3-5.47-1.31-5.47-5.81 0-1.28.47-2.33 1.24-3.15-.13-.3-.54-1.52.11-3.16 0 0 1.01-.32 3.3 1.2.96-.26 1.98-.39 3-.4 1.02 0 2.04.14 3 .4 2.29-1.52 3.29-1.2 3.29-1.2.66 1.64.25 2.86.12 3.16.78.82 1.24 1.87 1.24 3.15 0 4.51-2.81 5.5-5.49 5.79.43.36.81 1.07.81 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.68.83.57C20.57 21.88 24 17.48 24 12.29 24 5.78 18.63.5 12 .5Z" />
                </svg>
              </a>
              <a
                href="REPLACE_WITH_MY_LINKEDIN"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="flex size-9 items-center justify-center rounded-lg border border-border bg-transparent text-muted-foreground transition-all duration-300 hover:border-primary/50 hover:bg-primary/10 hover:text-primary hover:shadow-md hover:shadow-primary/20"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z" />
                </svg>
              </a>
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title} className="flex flex-col gap-4">
              <h4 className="text-sm font-semibold text-foreground">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-3">
                {col.links.map((l) => (
                  <li key={l.name}>
                    <a
                      href={l.href}
                      className="inline-block text-sm text-muted-foreground transition-all duration-200 hover:translate-x-0.5 hover:text-foreground"
                    >
                      {l.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-8 sm:flex-row">
          <p className="flex-1 text-center text-xs text-muted-foreground sm:text-left">
            &copy; {new Date().getFullYear()} Opportunity Radar. All rights reserved.
          </p>
          <p className="flex-1 text-center text-xs font-medium text-muted-foreground">
            Built by Laxman Sirvi
          </p>
          <p className="flex-1 text-center text-xs text-muted-foreground sm:text-right">
            Built for students. Designed for ambitious careers.
          </p>
        </div>
      </div>
    </footer>
  )
}
