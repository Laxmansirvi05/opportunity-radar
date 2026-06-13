'use client'

import { motion } from 'framer-motion'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { SectionHeading } from '@/components/landing/section-heading'

const FAQS = [
  {
    q: 'What is Opportunity Radar?',
    a: 'Opportunity Radar is an intelligent discovery platform that surfaces internships, jobs, hackathons, scholarships, workshops, and competitions in real time, then helps you track every application in one place.',
  },
  {
    q: 'Is it free?',
    a: 'Yes — you can discover opportunities, save them, and track applications on the free plan. Advanced tools like the ATS resume checker are available on premium tiers.',
  },
  {
    q: 'How often are opportunities updated?',
    a: 'The radar scans continuously throughout the day, pulling from across the web and verified community submissions, so fresh opportunities appear within minutes.',
  },
  {
    q: 'Can I track applications?',
    a: 'Absolutely. The visual pipeline lets you move opportunities through stages — saved, applied, interview, selected, or rejected — so you always know where you stand.',
  },
  {
    q: 'Can I submit opportunities?',
    a: 'Yes. Community members can submit opportunities, which are reviewed and added to the radar so everyone benefits.',
  },
  {
    q: 'Is my data private?',
    a: 'Your data is yours. We use industry-standard encryption and never sell your information. You control what you save and track.',
  },
  {
    q: 'Do I apply through Opportunity Radar?',
    a: 'You apply on the original source. Opportunity Radar links you directly to each opportunity and keeps your applications organized in one dashboard.',
  },
]

export function Faq() {
  return (
    <section id="faq" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions, answered"
          description="Everything you need to know about discovering and tracking opportunities."
        />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mt-12"
        >
          <Accordion className="flex flex-col gap-3">
            {FAQS.map((f, i) => (
              <AccordionItem
                key={f.q}
                value={`item-${i}`}
                className="glass rounded-xl border-none px-5"
              >
                <AccordionTrigger className="text-left text-base font-medium text-foreground hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}
