'use client'

import { motion, useInView, animate } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

const STATS = [
  { value: 2500, suffix: '+', label: 'Opportunities' },
  { value: 500, suffix: '+', label: 'Companies' },
  { value: 1000, suffix: '+', label: 'Students Tracking' },
  { value: 0, suffix: '', label: 'Added Daily', custom: 'New' },
]

function Counter({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (!inView) return
    const controls = animate(0, to, {
      duration: 1.6,
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

export function StatsBar() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.7 }}
      className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border/40 sm:grid-cols-4"
    >
      {STATS.map((s) => (
        <div
          key={s.label}
          className="glass flex flex-col items-start gap-1 px-5 py-4"
        >
          <span className="text-2xl font-semibold tracking-tight text-foreground text-glow">
            {s.custom ? s.custom : <Counter to={s.value} suffix={s.suffix} />}
          </span>
          <span className="text-xs leading-tight text-muted-foreground">
            {s.label}
          </span>
        </div>
      ))}
    </motion.div>
  )
}
