'use client'

import { motion } from 'framer-motion'
import { FileText, ShieldCheck, Download, ArrowRight } from 'lucide-react'
import { SectionHeading } from '@/components/landing/section-heading'

const TOOLS = [
  {
    icon: FileText,
    title: 'Resume Builder',
    desc: 'Craft a recruiter-ready resume with clean, modern templates designed to stand out.',
  },
  {
    icon: ShieldCheck,
    title: 'ATS Resume Checker',
    desc: 'Score your resume against applicant tracking systems and fix issues before you apply.',
  },
  {
    icon: Download,
    title: 'Resume Downloads',
    desc: 'Export polished PDFs in one click, tailored to each opportunity you pursue.',
  },
]

export function ResumeToolkit() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Resume toolkit"
          title="Everything you need to apply with confidence"
          description="Built-in tools to build, check, and export a resume that gets past the bots and onto the recruiter's desk."
        />
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {TOOLS.map((t, i) => {
            const Icon = t.icon
            return (
              <motion.div
                key={t.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: i * 0.12 }}
                whileHover={{ y: -8 }}
                className="glass group relative flex flex-col gap-4 overflow-hidden rounded-2xl p-7"
              >
                <div
                  className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: 'oklch(0.68 0.18 245 / 0.4)' }}
                />
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
                  <Icon className="size-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  {t.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t.desc}
                </p>
                <span className="mt-2 flex items-center gap-1 text-sm font-medium text-primary">
                  Try it{' '}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
