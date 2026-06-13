'use client'
import Link from 'next/link'

import { motion } from 'framer-motion'
import { ArrowRight, Radar } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FinalCta() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      {/* animated radar backdrop */}
      <div className="radar-grid absolute inset-0 opacity-40" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(70% 60% at 50% 40%, rgba(56,189,248,0.18), transparent 65%)',
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20"
            animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
            transition={{
              duration: 4,
              delay: i * 1.3,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        ))}
      </div>

      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-7 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30"
        >
          <Radar className="size-8 text-primary" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-balance text-4xl font-semibold tracking-tight text-foreground text-glow sm:text-5xl lg:text-6xl"
        >
          Your next opportunity is already out there.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-pretty text-lg leading-relaxed text-muted-foreground"
        >
          Stop searching across dozens of websites. Let Opportunity Radar bring
          everything together — and apply before everyone else.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Link
            href="/search"
            className="inline-flex items-center justify-center group h-13 rounded-full px-8 text-base font-medium shadow-lg shadow-primary/30 bg-primary text-primary-foreground hover:bg-primary/80 gap-2"
          >
              Start Exploring Opportunities
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
