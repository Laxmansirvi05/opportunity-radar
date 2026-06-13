'use client'
import Link from 'next/link'

import { motion } from 'framer-motion'
import { ArrowRight, LayoutDashboard, Radar } from 'lucide-react'
import { Button } from '@/components/ui/button'

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as any } },
}

export function HeroContent() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex max-w-[680px] flex-col items-start gap-7 lg:gap-8"
    >
      <motion.div
        variants={item}
        className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-primary" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Opportunity Intelligence
        </span>
      </motion.div>

      <motion.h1
        variants={item}
        className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl"
      >
        Never Miss an{' '}
        <span className="bg-gradient-to-r from-primary via-sky-400 to-accent bg-clip-text text-transparent">
          Opportunity
        </span>{' '}
        Again
      </motion.h1>

      <motion.p
        variants={item}
        className="text-pretty text-lg leading-relaxed text-muted-foreground"
      >
        Discover internships, jobs, hackathons, scholarships, workshops, and
        competitions from a single intelligent opportunity radar — all
        scanning in real time, so you&apos;re always one step ahead.
      </motion.p>

      <motion.div variants={item} className="flex flex-wrap items-center gap-3">
        <Link
          href="/search"
          className="inline-flex items-center justify-center group h-12 rounded-full px-6 text-base font-medium shadow-lg shadow-primary/25 bg-primary text-primary-foreground hover:bg-primary/80 gap-2"
        >
            <Radar className="size-4" />
            Explore Opportunities
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
        <Link
          href="/hub"
          className="inline-flex items-center justify-center glass h-12 rounded-full border border-border px-6 text-base font-medium hover:bg-secondary/60 bg-background text-foreground gap-2"
        >
            <LayoutDashboard className="size-4" />
            View Dashboard
        </Link>
      </motion.div>
    </motion.div>
  )
}
