'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import {
  Briefcase,
  GraduationCap,
  Code2,
  Award,
  Presentation,
  Trophy,
  Radar,
} from 'lucide-react'
import { SectionHeading } from '@/components/landing/section-heading'

const NODES = [
  { label: 'Internships', icon: Briefcase, count: '820+' },
  { label: 'Jobs', icon: Code2, count: '640+' },
  { label: 'Hackathons', icon: Trophy, count: '180+' },
  { label: 'Scholarships', icon: GraduationCap, count: '410+' },
  { label: 'Workshops', icon: Presentation, count: '250+' },
  { label: 'Competitions', icon: Award, count: '200+' },
]

export function OpportunityUniverse() {
  const [active, setActive] = useState<number | null>(null)

  // layout on a circle
  const radius = 200
  const center = { x: 260, y: 260 }
  const positions = NODES.map((_, i) => {
    const angle = (i / NODES.length) * Math.PI * 2 - Math.PI / 2
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    }
  })

  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Opportunity universe"
          title="One radar. Every kind of opportunity."
          description="Internships, jobs, hackathons, scholarships, workshops, and competitions — all connected to a single intelligent core."
        />

        <div className="mt-16 flex justify-center">
          <div className="relative aspect-square w-full max-w-[520px]">
            <svg viewBox="0 0 520 520" className="h-full w-full">
              {/* connecting lines */}
              {positions.map((p, i) => (
                <line
                  key={`line-${i}`}
                  x1={center.x}
                  y1={center.y}
                  x2={p.x}
                  y2={p.y}
                  stroke="currentColor"
                  className={
                    active === i ? 'text-primary' : 'text-primary/20'
                  }
                  strokeWidth={active === i ? 2 : 1}
                />
              ))}
              {/* animated pulse dots travelling along lines */}
              {positions.map((p, i) => (
                <motion.circle
                  key={`pulse-${i}`}
                  r={3}
                  className="fill-primary"
                  initial={{ cx: center.x, cy: center.y, opacity: 0 }}
                  animate={{
                    cx: [center.x, p.x],
                    cy: [center.y, p.y],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 2.4,
                    delay: i * 0.4,
                    repeat: Infinity,
                    repeatDelay: 1.2,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </svg>

            {/* central node */}
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
              <div className="relative flex size-24 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/30" />
                <Radar className="size-10 text-primary" />
              </div>
              <span className="mt-2 text-sm font-semibold text-foreground">
                Opportunity Radar
              </span>
            </div>

            {/* outer nodes */}
            {NODES.map((n, i) => {
              const Icon = n.icon
              const p = positions[i]
              return (
                <motion.button
                  key={n.label}
                  onHoverStart={() => setActive(i)}
                  onHoverEnd={() => setActive(null)}
                  initial={{ opacity: 0, scale: 0.6 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
                  style={{
                    left: `${(p.x / 520) * 100}%`,
                    top: `${(p.y / 520) * 100}%`,
                  }}
                >
                  <div
                    className={`flex size-16 items-center justify-center rounded-2xl border transition-all ${
                      active === i
                        ? 'scale-110 border-primary bg-primary/20 shadow-lg shadow-primary/30'
                        : 'border-border bg-card/70'
                    }`}
                  >
                    <Icon className="size-6 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {n.label}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {n.count}
                  </span>
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
