'use client'

import { motion, useInView, animate } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Target, Building2, ListChecks } from 'lucide-react'
import { SectionHeading } from '@/components/landing/section-heading'

const STATS = [
  { icon: Target, value: 2500, suffix: '+', label: 'Opportunities' },
  { icon: Building2, value: 500, suffix: '+', label: 'Companies' },
]

function Counter({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!inView) return
    const controls = animate(0, to, {
      duration: 1.8,
      ease: 'easeOut',
      onUpdate: (v) => setVal(Math.round(v)),
    })
    return () => controls.stop()
  }, [inView, to])
  return (
    <span ref={ref}>
      {val.toLocaleString()}
      {suffix}
    </span>
  )
}

export function PlatformBenefits() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center text-center">
          <SectionHeading
            eyebrow="By the numbers"
            title="Built for ambitious students at scale"
          />
        </div>
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-2">
          {STATS.map((s, i) => {
            const Icon = s.icon
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass flex flex-col items-center gap-3 rounded-2xl p-8 text-center"
              >
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
                  <Icon className="size-6 text-primary" />
                </div>
                <span className="text-4xl font-semibold tracking-tight text-foreground text-glow">
                  <Counter to={s.value} suffix={s.suffix} />
                </span>
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
