'use client'

import { motion } from 'framer-motion'
import { Radar, Bookmark, KanbanSquare, Trophy } from 'lucide-react'
import { SectionHeading } from '@/components/landing/section-heading'

const STEPS = [
  {
    icon: Radar,
    step: '01',
    title: 'Discover',
    desc: 'The radar continuously scans the web and community submissions to surface fresh opportunities the moment they appear.',
  },
  {
    icon: Bookmark,
    step: '02',
    title: 'Save',
    desc: 'Bookmark anything that catches your eye instantly. Your shortlist stays organized in one intelligent place.',
  },
  {
    icon: KanbanSquare,
    step: '03',
    title: 'Track',
    desc: 'Manage every application through a visual pipeline — from saved, to applied, to interview, to offer.',
  },
  {
    icon: Trophy,
    step: '04',
    title: 'Succeed',
    desc: 'Stay ahead of every deadline with smart reminders so you never miss the opportunity that matters most.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="How it works"
          title="From signal to success in four steps"
          description="Opportunity Radar turns the chaos of opportunity hunting into a calm, guided workflow."
        />

        <div className="relative mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* connecting line */}
          <div className="pointer-events-none absolute left-0 right-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent lg:block" />
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: i * 0.12 }}
                className="glass relative flex flex-col gap-4 rounded-2xl p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="relative flex size-12 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
                    <Icon className="size-6 text-primary" />
                  </div>
                  <span className="font-mono text-3xl font-semibold text-muted-foreground/30">
                    {s.step}
                  </span>
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {s.desc}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
