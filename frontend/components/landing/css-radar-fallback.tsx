'use client'

import { motion } from 'framer-motion'

const NODES = [
  { angle: 45, radius: 30, color: '#38bdf8' },
  { angle: 120, radius: 40, color: '#3b82f6' },
  { angle: 210, radius: 35, color: '#a855f7' },
  { angle: 315, radius: 45, color: '#60a5fa' },
  { angle: 80, radius: 25, color: '#38bdf8' },
  { angle: 160, radius: 48, color: '#a855f7' },
  { angle: 260, radius: 28, color: '#3b82f6' },
  { angle: 340, radius: 38, color: '#60a5fa' },
]

const CARDS = [
  { title: 'Google SWE Internship', tag: 'Internship', color: '#38bdf8', angle: 55, radius: 55 },
  { title: 'Global AI Hackathon', tag: 'Hackathon', color: '#a855f7', angle: 140, radius: 65 },
  { title: 'Research Scholarship', tag: 'Scholarship', color: '#60a5fa', angle: 230, radius: 50 },
  { title: 'Remote Developer Role', tag: 'Job', color: '#3b82f6', angle: 325, radius: 60 },
]

/**
 * Pure-CSS / Framer Motion radar visualization.
 * Used as a graceful fallback when WebGL is unavailable.
 */
export function CSSRadarFallback() {
  const SWEEP_DURATION = 6

  // Helper to convert polar to top/left percentages
  const getPos = (angleDeg: number, radiusPct: number) => {
    // 0 deg is top (12 o'clock) to match conic-gradient
    const rad = (angleDeg - 90) * (Math.PI / 180)
    return {
      left: `${50 + Math.cos(rad) * radiusPct}%`,
      top: `${50 + Math.sin(rad) * radiusPct}%`,
    }
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* ambient glows */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            'radial-gradient(circle at center, rgba(56,189,248,0.18), transparent 60%)',
        }}
      />

      {/* radar disc */}
      <div className="relative aspect-square w-[min(78vw,32rem)]">
        {/* concentric rings */}
        {[1, 0.75, 0.5, 0.25].map((scale) => (
          <div
            key={scale}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20"
            style={{ width: `${scale * 100}%`, height: `${scale * 100}%` }}
          />
        ))}

        {/* cross hairs */}
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-primary/10" />
        <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-primary/10" />

        {/* rotating sweep */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, rgba(56,189,248,0.35) 0deg, rgba(56,189,248,0.05) 45deg, transparent 80deg, transparent 360deg)',
            maskImage: 'radial-gradient(circle, black 0%, black 100%)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: SWEEP_DURATION, repeat: Infinity, ease: 'linear' }}
        />

        {/* center core */}
        <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_20px_rgba(56,189,248,0.9)]" />

        {/* pulsing opportunity nodes */}
        {NODES.map((n, i) => {
          // Calculate when the sweep hits this angle
          const hitDelay = (n.angle / 360) * SWEEP_DURATION
          return (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ ...getPos(n.angle, n.radius) }}
            >
              <span
                className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: n.color, boxShadow: `0 0 10px ${n.color}` }}
              />
              <motion.span
                className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: n.color }}
                animate={{ scale: [1, 3.5, 1, 1], opacity: [0, 0.8, 0, 0] }}
                transition={{
                  duration: SWEEP_DURATION,
                  times: [0, 0.05, 0.2, 1],
                  repeat: Infinity,
                  ease: 'easeOut',
                  delay: hitDelay,
                }}
              />
            </div>
          )
        })}

        {/* floating opportunity cards orbit relative to the radar disc */}
        {CARDS.map((c) => {
          const hitDelay = (c.angle / 360) * SWEEP_DURATION
          return (
            <motion.div
              key={c.title}
              className="absolute hidden w-44 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 px-3 py-2.5 shadow-2xl md:block"
              style={{
                background: 'rgba(13, 24, 46, 0.92)',
                ...getPos(c.angle, c.radius),
              }}
              // Fade in sharply when hit, hold, then soft fade out
              animate={{ opacity: [0, 1, 1, 0, 0], scale: [0.9, 1, 1, 0.95, 0.9] }}
              transition={{
                duration: SWEEP_DURATION,
                times: [0, 0.05, 0.25, 0.35, 1],
                repeat: Infinity,
                ease: 'easeInOut',
                delay: hitDelay,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color, boxShadow: `0 0 8px ${c.color}` }}
                />
                <span
                  className="font-mono text-[9px] uppercase tracking-widest"
                  style={{ color: c.color }}
                >
                  {c.tag}
                </span>
              </div>
              <p className="mt-1 text-[12px] font-medium leading-snug text-foreground">
                {c.title}
              </p>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
