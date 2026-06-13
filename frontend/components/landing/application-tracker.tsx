'use client'

import { motion } from 'framer-motion'
import { SectionHeading } from '@/components/landing/section-heading'

const COLUMNS = [
  {
    name: 'Saved',
    accent: 'text-muted-foreground',
    cards: [
      { role: 'Frontend Intern', org: 'Adobe' },
      { role: 'ML Research', org: 'NVIDIA' },
    ],
  },
  {
    name: 'Applied',
    accent: 'text-sky-400',
    cards: [
      { role: 'SWE Intern', org: 'Google' },
      { role: 'Data Analyst', org: 'Meta' },
    ],
  },
  {
    name: 'Interview',
    accent: 'text-accent',
    cards: [{ role: 'Product Intern', org: 'Atlassian' }],
  },
  {
    name: 'Selected',
    accent: 'text-emerald-400',
    cards: [{ role: 'Cloud Intern', org: 'Microsoft' }],
  },
  {
    name: 'Rejected',
    accent: 'text-destructive',
    cards: [{ role: 'Growth Intern', org: 'Stripe' }],
  },
]

export function ApplicationTracker() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Application tracker"
          title="Your whole pipeline at a glance"
          description="Drag opportunities through every stage. Always know exactly where you stand with each application."
        />

        <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {COLUMNS.map((col, ci) => (
            <motion.div
              key={col.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: ci * 0.1 }}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card/40 p-3"
            >
              <div className="flex items-center justify-between px-1">
                <span className={`text-xs font-semibold ${col.accent}`}>
                  {col.name}
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {col.cards.length}
                </span>
              </div>
              {col.cards.map((c, i) => (
                <motion.div
                  key={c.role}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: ci * 0.1 + i * 0.08 }}
                  whileHover={{ y: -4 }}
                  className="glass rounded-xl p-3"
                >
                  <p className="text-sm font-medium text-foreground">
                    {c.role}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.org}
                  </p>
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r from-primary to-accent`}
                      style={{ width: `${(ci + 1) * 20}%` }}
                    />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
