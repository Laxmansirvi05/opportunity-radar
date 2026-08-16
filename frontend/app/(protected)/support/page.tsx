import Link from 'next/link'
import { FaqAccordion, type FaqItem } from '@/features/support/components/faq-accordion'

export const metadata = {
  title: 'Support & Info | Opportunity Radar'
}

interface FaqGroup {
  title: string
  icon: string
  items: FaqItem[]
}

const FAQ_GROUPS: FaqGroup[] = [
  {
    title: 'Getting Started',
    icon: 'rocket_launch',
    items: [
      {
        q: 'What is Opportunity Radar?',
        a: 'A single platform that brings together job/internship search, an AI resume toolkit, an application tracker, certification discovery, AI interview practice, and a student community — so you don’t have to check a dozen sites separately.',
      },
      {
        q: 'Is Opportunity Radar free to use?',
        a: 'Yes. Creating an account and using the core platform — search, tracker, resume builder, ATS checker, AI Optimiser, certifications, Hub, and mock interviews — is free.',
      },
      {
        q: 'How do I get started?',
        a: 'Create an account, then either build a resume from scratch or upload an existing one from the Resume Toolkit. From there, use AI Search or the Search page to find matching opportunities and start tracking your applications.',
      },
    ],
  },
  {
    title: 'Resume Toolkit',
    icon: 'description',
    items: [
      {
        q: 'What’s the difference between the ATS Checker and the AI Optimiser?',
        a: 'The ATS Checker gives you a one-off readiness or targeted-match score for a resume. The AI Optimiser does the same scoring, then goes further — it identifies specific gaps and can generate a polished or fully role-aligned rewrite of your resume.',
      },
      {
        q: 'Why did my ATS score and AI Optimiser score differ?',
        a: 'They shouldn’t, for the same resume and job description — both features share the same scoring engine and now reuse each other’s evaluation for an identical resume + job description, so the number should match exactly.',
      },
      {
        q: 'Can I download the resumes the AI generates?',
        a: 'Yes. Every scored resume — your original, the polished rewrite, and the fully role-aligned version — can be previewed and downloaded as an ATS-safe PDF from the Resume Toolkit.',
      },
      {
        q: 'How much of my history is saved?',
        a: 'Your last 6 ATS checks and your last 6 AI Optimiser runs are kept in History, each individually deletable. Your saved resumes themselves are kept until you delete them.',
      },
    ],
  },
  {
    title: 'AI Search & Applications',
    icon: 'travel_explore',
    items: [
      {
        q: 'How does AI Search find opportunities for me?',
        a: 'It reads your saved resume’s skills and experience and matches them against open listings, ranking results by relevance to your actual background rather than just keyword overlap.',
      },
      {
        q: 'How do I track an application after I apply?',
        a: 'Save any opportunity from Search or AI Search, then move it through stages — Saved, Applied, Interviewing, Offer, Rejected — from the Tracker.',
      },
      {
        q: 'How often are new opportunities added?',
        a: 'Listings refresh on a regular schedule from every connected source, so new postings and updated deadlines appear automatically without you needing to re-search.',
      },
    ],
  },
  {
    title: 'Certifications',
    icon: 'school',
    items: [
      {
        q: 'Are certifications shown here issued by Opportunity Radar?',
        a: 'No — every certification in the catalogue is issued by its original provider (Coursera, Microsoft Learn, Google, AWS, Cisco Networking Academy, Udemy, DataCamp, and others). We only index and link to them; completing one earns you a credential from that provider, not from us.',
      },
      {
        q: 'What does "Free" actually mean on a certification card?',
        a: 'It means the certificate itself is free to earn, not just that enrollment is free. Several providers (Coursera among them) let you audit a course for free but charge for the certificate — those are labeled with their real price, not marked "Free".',
      },
      {
        q: 'A course looks like it’s from Google or Microsoft — is it?',
        a: 'Only if the provider tag says so directly (e.g. "Microsoft Learn", "Google Cloud"). A course titled something like "Google Data Analytics" but tagged "Coursera" is a Coursera-hosted course built in collaboration with Google — Coursera issues the certificate, not Google directly.',
      },
    ],
  },
  {
    title: 'AI Mock Interview',
    icon: 'record_voice_over',
    items: [
      {
        q: 'Is the mock interview a real person?',
        a: 'No — it’s a live AI interviewer you speak with in real time. It asks role-relevant questions, listens to your spoken answers, and gives you feedback afterward.',
      },
      {
        q: 'Is my interview audio saved?',
        a: 'The live audio itself isn’t retained after your session ends — only the transcript and the feedback generated from it are kept, so you can review past sessions.',
      },
    ],
  },
  {
    title: 'Hub Community',
    icon: 'forum',
    items: [
      {
        q: 'Who can see what I post in the Hub?',
        a: 'Any other signed-in student on the platform. It’s a shared space, unlike your private profile and resume data — keep that in mind before sharing personal details.',
      },
      {
        q: 'Can I edit or delete a message after sending it?',
        a: 'Yes, at any time — open the message’s action menu to edit or delete it. Edited messages show an "edited" label to other members.',
      },
    ],
  },
  {
    title: 'Account & Privacy',
    icon: 'shield_person',
    items: [
      {
        q: 'How do I delete my account?',
        a: 'Go to Settings → Danger Zone → Delete Account. This permanently removes your profile, resumes, tracked opportunities, and history — it can’t be undone.',
      },
      {
        q: 'Where can I read the full privacy details?',
        a: 'See our full Privacy Policy and Terms of Service, linked below, for exactly what we collect, how AI features process your data, and your rights.',
      },
    ],
  },
]

export default function SupportPage() {
  return (
    <div className="flex flex-col gap-12 max-w-4xl mx-auto w-full pb-16">
      <header className="mb-2">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-1">
          Support & Information
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">Get help, browse answers to common questions, and read our platform policies.</p>
      </header>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <div className="w-12 h-12 bg-primary-container text-on-primary-container rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">contact_support</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-on-background font-bold mb-1">Contact Us</h3>
            <p className="text-sm text-on-surface-variant mb-4">Can’t find an answer below? Have an account or billing issue? Reach our support team directly.</p>
            <a href="mailto:support@opportunityradar.com" className="inline-flex items-center gap-2 text-primary font-bold hover:underline">
              support@opportunityradar.com
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </a>
          </div>
        </div>

        <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <div className="w-12 h-12 bg-secondary-container text-on-secondary-container rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">info</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-on-background font-bold mb-1">About Us</h3>
            <p className="text-sm text-on-surface-variant mb-4">Opportunity Radar is a platform dedicated to bringing verified, high-quality career opportunities directly to students.</p>
            <Link href="/search" className="inline-flex items-center gap-2 text-primary font-bold hover:underline">
              Explore Opportunities
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="font-headline-md text-headline-md text-on-background font-bold mb-1">Frequently Asked Questions</h3>
          <p className="text-sm text-on-surface-variant">Answers about every feature on the platform, grouped by area.</p>
        </div>

        <div className="flex flex-col gap-10">
          {FAQ_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">{group.icon}</span>
                <h4 className="font-headline-sm text-headline-sm text-on-background font-bold">{group.title}</h4>
              </div>
              <FaqAccordion items={group.items} />
            </div>
          ))}
        </div>
      </div>

      {/* Policies */}
      <div className="flex flex-col gap-4">
        <h3 className="font-headline-md text-headline-md text-on-background font-bold">Policies</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <div className="w-12 h-12 bg-surface-container-high text-on-surface rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">lock</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-on-background font-bold mb-1">Privacy Policy</h3>
              <p className="text-sm text-on-surface-variant mb-4">Learn how we collect, use, and protect your personal information.</p>
              <Link href="/privacy" className="inline-flex items-center gap-2 text-on-surface-variant font-bold hover:text-primary transition-colors">
                View Policy
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </div>

          <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <div className="w-12 h-12 bg-surface-container-high text-on-surface rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">gavel</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-on-background font-bold mb-1">Terms of Service</h3>
              <p className="text-sm text-on-surface-variant mb-4">Read the rules and guidelines for using the Opportunity Radar platform.</p>
              <Link href="/terms" className="inline-flex items-center gap-2 text-on-surface-variant font-bold hover:text-primary transition-colors">
                View Terms
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
