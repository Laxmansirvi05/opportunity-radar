'use client'

import { motion } from 'framer-motion'

const COMPANIES = [
  'Google',
  'Microsoft',
  'Amazon',
  'Meta',
  'Adobe',
  'Atlassian',
  'NVIDIA',
  'Intel',
]

export function TrustBar() {
  const row = [...COMPANIES, ...COMPANIES]
  return (
    <section className="relative border-y border-border bg-card/30 py-12">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Trusted by students preparing for opportunities from
        </p>
        <div className="relative mt-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
          <motion.div
            className="flex w-max items-center gap-16"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 28, ease: 'linear', repeat: Infinity }}
          >
            {row.map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="whitespace-nowrap text-2xl font-semibold tracking-tight text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                {name}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
