'use client'

import { motion } from 'framer-motion'
import { X, Check } from 'lucide-react'
import { SectionHeading } from '@/components/landing/section-heading'

const TRADITIONAL = [
  'Dozens of open browser tabs',
  'Missed application deadlines',
  'Scattered, disorganized information',
  'Manual tracking in spreadsheets',
]

const RADAR = [
  'A single intelligent dashboard',
  'Fresh opportunities in real time',
  'Automatic deadline tracking',
  'Visual application management',
]

export function WhyRadar() {
  return (
    <section id="why" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Why Opportunity Radar"
          title="Stop hunting. Start discovering."
          description="The old way is exhausting and error-prone. Opportunity Radar brings calm, clarity, and a real edge."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
            className="flex flex-col gap-5 rounded-2xl border border-border bg-card/40 p-8"
          >
            <h3 className="text-lg font-semibold text-muted-foreground">
              Traditional Search
            </h3>
            <ul className="flex flex-col gap-4">
              {TRADITIONAL.map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive/15">
                    <X className="size-3.5 text-destructive" />
                  </span>
                  <span className="text-sm text-muted-foreground">{t}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-8"
          >
            <div
              className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full blur-3xl"
              style={{ background: 'oklch(0.68 0.18 245 / 0.25)' }}
            />
            <h3 className="text-lg font-semibold text-foreground">
              Opportunity Radar
            </h3>
            <ul className="flex flex-col gap-4">
              {RADAR.map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20">
                    <Check className="size-3.5 text-primary" />
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {t}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
