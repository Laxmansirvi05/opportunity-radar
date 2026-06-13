'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Briefcase, GraduationCap, Trophy, Clock } from 'lucide-react'

const FEED = [
  { icon: Briefcase, text: 'New Internship Detected', org: 'Google' },
  { icon: GraduationCap, text: 'Scholarship Added', org: 'Knight Foundation' },
  { icon: Clock, text: 'Hackathon Closing Soon', org: 'MLH' },
  { icon: Briefcase, text: 'New Remote Job Posted', org: 'Amazon' },
  { icon: Trophy, text: 'Competition Just Opened', org: 'Kaggle' },
]

export function LiveActivity() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % FEED.length)
    }, 3200)
    return () => clearInterval(id)
  }, [])

  const current = FEED[index]
  const Icon = current.icon

  return (
    <div className="pointer-events-none absolute bottom-28 right-6 z-20 hidden w-64 lg:block">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="glass flex items-center gap-3 rounded-xl p-3 shadow-2xl"
        >
          <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Icon className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" />
              <p className="truncate text-xs font-medium text-foreground">
                {current.text}
              </p>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              {current.org}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
