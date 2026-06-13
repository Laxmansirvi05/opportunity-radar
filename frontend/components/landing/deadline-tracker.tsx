'use client'

import { motion } from 'framer-motion'
import { SectionHeading } from '@/components/landing/section-heading'

const RINGS = [
  { label: 'Closing Today', value: 0.96, urgency: 'Apply now', color: 'oklch(0.62 0.22 25)' },
  { label: '12 Hours Left', value: 0.85, urgency: 'Urgent', color: 'oklch(0.7 0.18 50)' },
  { label: '2 Days Remaining', value: 0.55, urgency: 'Soon', color: 'oklch(0.68 0.18 245)' },
  { label: '7 Days Remaining', value: 0.3, urgency: 'Plan ahead', color: 'oklch(0.62 0.19 290)' },
]

function Ring({
  value,
  color,
  label,
  urgency,
  delay,
}: {
  value: number
  color: string
  label: string
  urgency: string
  delay: number
}) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay }}
      className="glass flex flex-col items-center gap-4 rounded-2xl p-6"
    >
      <div className="relative size-32">
        <svg viewBox="0 0 128 128" className="size-full -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            strokeWidth="8"
            className="stroke-secondary"
          />
          <motion.circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            stroke={color}
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            whileInView={{ strokeDashoffset: c * (1 - value) }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, delay: delay + 0.2, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color }}
          >
            {urgency}
          </span>
        </div>
      </div>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </motion.div>
  )
}

export function DeadlineTracker() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Smart deadline tracker"
          title="Beat every deadline with confidence"
          description="Animated countdown rings keep urgency front and center, so a closing window never slips past you."
        />
        <div className="mt-16 grid grid-cols-2 gap-5 lg:grid-cols-4">
          {RINGS.map((r, i) => (
            <Ring key={r.label} {...r} delay={i * 0.12} />
          ))}
        </div>
      </div>
    </section>
  )
}
