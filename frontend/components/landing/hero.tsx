'use client'

import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { Radar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HeroContent } from '@/components/landing/hero-content'

const RadarScene = dynamic(
  () => import('@/components/landing/radar-scene').then((m) => m.RadarScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <div className="size-40 animate-pulse rounded-full border border-primary/20 bg-primary/5 blur-xl" />
      </div>
    ),
  },
)

function NavBar() {
  const links = [
    { label: 'Features', href: '#how-it-works' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Companies', href: '#opportunities' },
    { label: 'Dashboard', href: '#' },
  ]
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-x-0 top-0 z-30"
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5 lg:-ml-12">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <Radar className="size-5 text-primary" />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">
            Opportunity Radar
          </span>
        </div>
        <div className="hidden items-center gap-8 lg:flex">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="rounded-full text-muted-foreground hover:text-foreground"
            size="sm"
          >
            Sign In
          </Button>
          <Button
            className="rounded-full shadow-lg shadow-primary/25"
            size="sm"
          >
            Sign Up
          </Button>
        </div>
      </nav>
    </motion.header>
  )
}

export function Hero() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Layered background: radar grid + radial glows */}
      <div className="radar-grid absolute inset-0 opacity-60" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 70% 30%, rgba(56,189,248,0.16), transparent 60%), radial-gradient(90% 70% at 20% 80%, rgba(168,85,247,0.12), transparent 55%)',
        }}
      />
      {/* bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

      <NavBar />

      {/* 3D scene — fills the right half on desktop, full bleed on mobile */}
      <div className="absolute inset-0 lg:left-[44%]">
        <RadarScene />
      </div>

      {/* Readability scrim behind content (stronger on mobile) */}
      <div
        className="pointer-events-none absolute inset-0 lg:hidden"
        style={{
          background:
            'linear-gradient(180deg, rgba(10,14,26,0.55) 0%, rgba(10,14,26,0.35) 45%, rgba(10,14,26,0.85) 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          background:
            'linear-gradient(90deg, rgba(10,14,26,0.85) 0%, rgba(10,14,26,0.4) 38%, transparent 60%)',
        }}
      />

      {/* Content grid */}
      <div className="relative z-20 mx-auto flex min-h-screen max-w-7xl items-center px-6 pt-24 pb-12 -mt-6">
        <div className="lg:-ml-[72px]">
          <HeroContent />
        </div>
      </div>
    </section>
  )
}
