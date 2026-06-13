'use client'

import { motion } from 'framer-motion'
import { MapPin, Clock, ArrowUpRight } from 'lucide-react'
import { SectionHeading } from '@/components/landing/section-heading'

const OPPS = [
  {
    org: 'Google',
    role: 'Software Engineering Intern',
    category: 'Internship',
    location: 'Mountain View, CA',
    deadline: 'Closes in 5 days',
    posted: 'Posted 12 minutes ago',
    hot: true,
  },
  {
    org: 'Major League Hacking',
    role: 'Global AI Hackathon 2026',
    category: 'Hackathon',
    location: 'Remote',
    deadline: 'Closes in 2 days',
    posted: 'Posted 1 hour ago',
    hot: true,
  },
  {
    org: 'Knight Foundation',
    role: 'STEM Excellence Scholarship',
    category: 'Scholarship',
    location: 'Global',
    deadline: 'Closes in 14 days',
    posted: 'Posted Today',
    hot: false,
  },
  {
    org: 'Amazon',
    role: 'Graduate Software Developer',
    category: 'Job',
    location: 'Seattle, WA',
    deadline: 'Closes in 9 days',
    posted: 'Posted 3 hours ago',
    hot: false,
  },
  {
    org: 'Kaggle',
    role: 'Data Science Grand Prix',
    category: 'Competition',
    location: 'Remote',
    deadline: 'Closes in 21 days',
    posted: 'Posted Today',
    hot: false,
  },
  {
    org: 'NVIDIA',
    role: 'Deep Learning Workshop',
    category: 'Workshop',
    location: 'Online',
    deadline: 'Closes in 4 days',
    posted: 'Posted 30 minutes ago',
    hot: true,
  },
]

const categoryColor: Record<string, string> = {
  Internship: 'bg-primary/15 text-primary',
  Hackathon: 'bg-accent/15 text-accent',
  Scholarship: 'bg-emerald-400/15 text-emerald-400',
  Job: 'bg-sky-400/15 text-sky-400',
  Competition: 'bg-amber-400/15 text-amber-400',
  Workshop: 'bg-fuchsia-400/15 text-fuchsia-400',
}

export function OpportunityFeed() {
  return (
    <section id="opportunities" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Fresh opportunities"
          title="Caught by the radar, just now"
          description="A live feed of the freshest opportunities, complete with deadlines and freshness indicators so you can act first."
        />

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {OPPS.map((o, i) => (
            <motion.article
              key={o.role}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
              whileHover={{ y: -6 }}
              className="glass group flex flex-col gap-4 rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-sm font-semibold text-foreground">
                    {o.org.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight text-foreground">
                      {o.org}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor[o.category]}`}
                    >
                      {o.category}
                    </span>
                  </div>
                </div>
                {o.hot ? (
                  <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                    <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
                    Hot
                  </span>
                ) : null}
              </div>

              <h3 className="text-base font-medium leading-snug text-foreground">
                {o.role}
              </h3>

              <div className="mt-auto flex flex-col gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" /> {o.location}
                </span>
                <span className="flex items-center gap-1.5 text-foreground/80">
                  <Clock className="size-3.5 text-primary" /> {o.deadline}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="font-mono text-[11px] text-emerald-400">
                  {o.posted}
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  View <ArrowUpRight className="size-3.5" />
                </span>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
