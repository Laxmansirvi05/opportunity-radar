import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | Opportunity Radar'
}

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'information-collected', label: 'Information We Collect' },
  { id: 'data-usage', label: 'How We Use Your Data' },
  { id: 'ai-processing', label: 'AI Processing & Model Providers' },
  { id: 'community-content', label: 'Community & Chat Content' },
  { id: 'sharing', label: 'Who We Share Data With' },
  { id: 'cookies', label: 'Cookies & Local Storage' },
  { id: 'retention', label: 'Data Retention' },
  { id: 'security', label: 'Security Standards' },
  { id: 'your-rights', label: 'Your Rights & Choices' },
  { id: 'data-deletion', label: 'Account Deletion' },
  { id: 'children', label: "Children's Privacy" },
  { id: 'changes', label: 'Changes to This Policy' },
  { id: 'contact', label: 'Contact Us' },
]

function SectionHeading({ icon, id, children }: { icon: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="material-symbols-outlined text-primary" aria-hidden="true">{icon}</span>
      <h2 id={`${id}-heading`} className="font-headline-md text-headline-md">{children}</h2>
    </div>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      <header className="w-full top-0 sticky z-50 bg-surface border-b border-outline-variant">
        <div className="flex justify-between items-center h-16 px-gutter max-w-container-max mx-auto">
          <div className="flex items-center gap-10">
            <Link href="/" className="font-headline-md text-headline-md font-bold text-primary cursor-pointer active:scale-95 transition-transform">
              Opportunity Radar
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="font-label-md text-label-md px-4 py-2 border border-outline-variant rounded hover:bg-surface-container-low transition-colors">Back to App</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-container-max mx-auto px-gutter py-10 w-full">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Table of Contents */}
          <nav aria-label="Table of contents" className="hidden md:block md:col-span-3">
            <div className="sticky top-24 flex flex-col gap-1 border-l border-outline-variant pl-4">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">On this page</p>
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors py-1"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </nav>

          {/* Main Content Area */}
          <article className="md:col-span-9">
            <header className="mb-10 border-b border-outline-variant pb-6">
              <h1 className="font-display text-display mb-2">Privacy Policy</h1>
              <div className="flex flex-wrap items-center gap-4">
                <p className="font-body-md text-body-md text-on-surface-variant">Last Updated: August 16, 2026</p>
                <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
                <p className="font-body-md text-body-md text-on-surface-variant">Version 2.0.0</p>
              </div>
            </header>

            <div className="space-y-12">
              <section className="scroll-mt-24" id="overview">
                <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-lg">
                  <p className="font-body-lg text-body-lg leading-relaxed text-on-surface">
                    Opportunity Radar ("we," "us," "our," or the "Platform") helps students discover opportunities, build and score resumes with AI, practice interviews, and connect with other students. This Privacy Policy explains, in plain language, what information we collect, why we collect it, who we share it with, and the choices and controls you have. By creating an account, you agree to the practices described here.
                  </p>
                </div>
              </section>

              <section className="scroll-mt-24" id="information-collected">
                <SectionHeading icon="inventory_2" id="information-collected">Information We Collect</SectionHeading>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-surface border border-outline-variant rounded-lg">
                    <h4 className="font-headline-sm text-headline-sm mb-1">Account & Profile</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">Name, email address, and profile details (college, graduation year, skills, links) you choose to add.</p>
                  </div>
                  <div className="p-4 bg-surface border border-outline-variant rounded-lg">
                    <h4 className="font-headline-sm text-headline-sm mb-1">Resumes & Career Documents</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">Resume content — whether built in our editor or uploaded as a PDF — including work history, education, skills, and project descriptions.</p>
                  </div>
                  <div className="p-4 bg-surface border border-outline-variant rounded-lg">
                    <h4 className="font-headline-sm text-headline-sm mb-1">Job Descriptions You Provide</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">Text you paste into the ATS Checker or AI Optimiser to score your resume against a specific role.</p>
                  </div>
                  <div className="p-4 bg-surface border border-outline-variant rounded-lg">
                    <h4 className="font-headline-sm text-headline-sm mb-1">Interview Practice Audio</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">Voice audio streamed during AI Mock Interview sessions, and the resulting transcript, used only to run and score that session.</p>
                  </div>
                  <div className="p-4 bg-surface border border-outline-variant rounded-lg">
                    <h4 className="font-headline-sm text-headline-sm mb-1">Community Content</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">Messages, images, and profile info you share in the Hub, our student community chat.</p>
                  </div>
                  <div className="p-4 bg-surface border border-outline-variant rounded-lg">
                    <h4 className="font-headline-sm text-headline-sm mb-1">Usage & Device Data</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">IP address, browser type, device information, and which features you use — collected automatically to keep the Platform secure and working.</p>
                  </div>
                </div>
              </section>

              <section className="scroll-mt-24" id="data-usage">
                <SectionHeading icon="data_usage" id="data-usage">How We Use Your Data</SectionHeading>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 p-6 bg-primary-container text-on-primary-container rounded-xl flex flex-col justify-between">
                    <div>
                      <h4 className="font-headline-sm text-headline-sm mb-2">Opportunity Matching</h4>
                      <p className="font-body-md text-body-md opacity-90">We use your profile, skills, and resume content to power AI Search and our recommendation logic, surfacing internships, jobs, and scholarships that fit your background.</p>
                    </div>
                  </div>
                  <div className="p-6 bg-secondary-fixed text-on-secondary-fixed rounded-xl">
                    <h4 className="font-headline-sm text-headline-sm mb-2">Resume Scoring</h4>
                    <p className="font-body-md text-body-md">Evaluating your resume against a job description to produce an ATS score, gap analysis, and rewritten resume versions.</p>
                  </div>
                  <div className="p-6 bg-surface-container-high rounded-xl border border-outline-variant">
                    <h4 className="font-headline-sm text-headline-sm mb-2">Interview Coaching</h4>
                    <p className="font-body-md text-body-md">Running your mock interview session and generating feedback on your responses.</p>
                  </div>
                  <div className="p-6 bg-surface rounded-xl border border-outline-variant">
                    <h4 className="font-headline-sm text-headline-sm mb-2">Communication</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">Sending account, security, and deadline-reminder notifications you've opted into.</p>
                  </div>
                  <div className="md:col-span-2 p-6 bg-surface rounded-xl border border-outline-variant">
                    <h4 className="font-headline-sm text-headline-sm mb-2">Platform Integrity & Improvement</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">Detecting abuse, debugging errors, and analyzing aggregated (non-identifying) usage patterns to improve features and performance.</p>
                  </div>
                </div>
              </section>

              <section className="scroll-mt-24" id="ai-processing">
                <SectionHeading icon="auto_awesome" id="ai-processing">AI Processing & Model Providers</SectionHeading>
                <div className="p-6 bg-surface border border-outline-variant rounded-lg space-y-4">
                  <p className="font-body-lg text-body-lg">
                    Features like the AI Search, AI Resume Optimiser, ATS Checker, AI Assistant, and AI Mock Interview send the relevant content — your resume text, a job description, a chat message, or interview audio — to a third-party AI model provider to generate a response. We route requests across several providers (currently including Google Gemini, Groq, Mistral, and OpenRouter) so a feature keeps working if one provider is unavailable.
                  </p>
                  <ul className="list-disc pl-6 space-y-2 font-body-md text-body-md text-on-surface-variant">
                    <li>Only the content needed to complete your request is sent — for example, a resume and job description for a scoring request, or interview audio for a live session.</li>
                    <li>We do not permit these providers to use your data to train their general-purpose models, per our agreements with them, and we do not sell this data to anyone.</li>
                    <li>The results (scores, suggestions, transcripts) are stored in our database exactly like any other resume or interview data you generate, and are covered by the same retention and deletion rules described below.</li>
                    <li>Mock interview audio is streamed through LiveKit, our real-time media provider, for the duration of the session only.</li>
                  </ul>
                </div>
              </section>

              <section className="scroll-mt-24" id="community-content">
                <SectionHeading icon="forum" id="community-content">Community & Chat Content</SectionHeading>
                <div className="p-6 bg-surface border border-outline-variant rounded-lg space-y-3">
                  <p className="font-body-lg text-body-lg">
                    The Hub is a shared space — anything you post there, including your display name, profile photo, messages, and images, is visible to other signed-in students on the Platform. It is not private in the way your resume or profile data is.
                  </p>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    You can edit or delete your own messages at any time, and clear your local view of the chat from the Hub settings. Deleting a message removes its content for everyone; it does not remove earlier replies to it.
                  </p>
                </div>
              </section>

              <section className="scroll-mt-24" id="sharing">
                <SectionHeading icon="share" id="sharing">Who We Share Data With</SectionHeading>
                <div className="p-6 bg-surface border border-outline-variant rounded-lg space-y-4">
                  <p className="font-body-lg text-body-lg font-bold">We do not sell your personal information. Ever.</p>
                  <p className="font-body-md text-body-md text-on-surface-variant">We share data only with the service providers that operate the Platform, and only as needed for them to provide that service:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 border border-outline-variant rounded-lg">
                      <p className="font-label-md text-label-md font-bold text-on-surface">Supabase</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">Database, authentication, and file storage</p>
                    </div>
                    <div className="p-3 border border-outline-variant rounded-lg">
                      <p className="font-label-md text-label-md font-bold text-on-surface">Vercel</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">Application hosting and delivery</p>
                    </div>
                    <div className="p-3 border border-outline-variant rounded-lg">
                      <p className="font-label-md text-label-md font-bold text-on-surface">AI model providers</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">Google Gemini, Groq, Mistral, OpenRouter — see AI Processing above</p>
                    </div>
                    <div className="p-3 border border-outline-variant rounded-lg">
                      <p className="font-label-md text-label-md font-bold text-on-surface">LiveKit</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">Real-time audio for mock interview sessions</p>
                    </div>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant">We may also disclose information if required by law, to protect the rights and safety of our users, or in connection with a merger or acquisition — in which case this policy would continue to apply to your data.</p>
                </div>
              </section>

              <section className="scroll-mt-24" id="cookies">
                <SectionHeading icon="cookie" id="cookies">Cookies & Local Storage</SectionHeading>
                <div className="p-6 bg-surface border border-outline-variant rounded-lg space-y-3">
                  <p className="font-body-lg text-body-lg">
                    We use strictly functional cookies and browser storage — to keep you signed in, remember in-progress work (like an unsent AI Assistant draft), and protect the Platform from abuse. We do not use advertising or cross-site tracking cookies, and we do not run third-party analytics or ad-tech scripts.
                  </p>
                </div>
              </section>

              <section className="scroll-mt-24" id="retention">
                <SectionHeading icon="schedule" id="retention">Data Retention</SectionHeading>
                <div className="p-6 bg-surface border border-outline-variant rounded-lg space-y-3">
                  <p className="font-body-lg text-body-lg">
                    We keep your account data for as long as your account is active, so features like ATS/Optimiser history and saved resumes work the way you'd expect. Interview audio is not retained after your session ends — only the transcript and generated feedback are kept. When you delete your account, associated personal data is permanently removed as described in Account Deletion below, aside from records we're legally required to retain (such as for fraud prevention or tax/accounting purposes).
                  </p>
                </div>
              </section>

              <section className="scroll-mt-24" id="security">
                <SectionHeading icon="shield" id="security">Security Standards</SectionHeading>
                <div className="p-6 bg-surface border border-outline-variant rounded-lg space-y-4">
                  <p className="font-body-lg text-body-lg">We use TLS encryption for all data in transit, and encryption at rest for stored data. Access to your account data is protected by row-level security policies scoped to your own user id, so one student's data is never readable by another's application session. We restrict internal access to production data to what's necessary for operating the Platform.</p>
                </div>
              </section>

              <section className="scroll-mt-24" id="your-rights">
                <SectionHeading icon="fact_check" id="your-rights">Your Rights & Choices</SectionHeading>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-surface border border-outline-variant rounded-lg">
                    <h4 className="font-headline-sm text-headline-sm mb-1">Access & Review</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">Your profile, resumes, and history are visible to you directly in the app at any time.</p>
                  </div>
                  <div className="p-4 bg-surface border border-outline-variant rounded-lg">
                    <h4 className="font-headline-sm text-headline-sm mb-1">Correction</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">Edit your profile and resumes yourself, whenever you want, from Settings and the Resume Toolkit.</p>
                  </div>
                  <div className="p-4 bg-surface border border-outline-variant rounded-lg">
                    <h4 className="font-headline-sm text-headline-sm mb-1">Notification Preferences</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">Turn email alerts on or off from Settings at any time.</p>
                  </div>
                  <div className="p-4 bg-surface border border-outline-variant rounded-lg">
                    <h4 className="font-headline-sm text-headline-sm mb-1">Requests Not Self-Serviceable</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">For a data export or any request this page doesn't cover, contact us — see Contact Us below.</p>
                  </div>
                </div>
              </section>

              <section className="scroll-mt-24" id="data-deletion">
                <SectionHeading icon="delete_forever" id="data-deletion">Account Deletion</SectionHeading>
                <div className="p-6 bg-surface border border-outline-variant rounded-lg space-y-4">
                  <p className="font-body-lg text-body-lg">You have full control over your data. You may permanently delete your account at any time from Settings → Danger Zone. This immediately and permanently erases your profile, saved resumes, ATS/Optimiser history, saved opportunities, tracker entries, and notification settings from our database. This action cannot be undone.</p>
                </div>
              </section>

              <section className="scroll-mt-24" id="children">
                <SectionHeading icon="child_care" id="children">Children's Privacy</SectionHeading>
                <div className="p-6 bg-surface border border-outline-variant rounded-lg space-y-3">
                  <p className="font-body-lg text-body-lg">
                    Opportunity Radar is built for students preparing for internships, jobs, and further study, and is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has created an account, contact us and we will remove it.
                  </p>
                </div>
              </section>

              <section className="scroll-mt-24" id="changes">
                <SectionHeading icon="update" id="changes">Changes to This Policy</SectionHeading>
                <div className="p-6 bg-surface border border-outline-variant rounded-lg space-y-3">
                  <p className="font-body-lg text-body-lg">
                    We may update this Privacy Policy as the Platform evolves. When we make a material change, we'll update the "Last Updated" date above and, where appropriate, notify you in-app. Continuing to use Opportunity Radar after a change takes effect means you accept the updated policy.
                  </p>
                </div>
              </section>

              <section className="scroll-mt-24" id="contact">
                <SectionHeading icon="mail" id="contact">Contact Us</SectionHeading>
                <div className="p-6 bg-primary-container text-on-primary-container rounded-lg space-y-3">
                  <p className="font-body-lg text-body-lg">
                    Questions about this policy, or a request about your data? Reach us at{' '}
                    <a href="mailto:privacy@opportunityradar.com" className="font-bold underline underline-offset-2">
                      privacy@opportunityradar.com
                    </a>
                    . For general support, visit our{' '}
                    <Link href="/support" className="font-bold underline underline-offset-2">Support Center</Link>.
                  </p>
                </div>
              </section>
            </div>
          </article>
        </div>
      </main>

      <footer className="w-full py-10 mt-auto bg-surface border-t border-outline-variant">
        <div className="flex flex-col md:flex-row justify-between items-center px-gutter max-w-container-max mx-auto gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="font-label-md text-label-md font-bold text-primary">Opportunity Radar</span>
            <p className="font-label-sm text-label-sm text-on-surface-variant opacity-80">© 2026 Opportunity Radar</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Terms of Service</Link>
            <Link href="/support" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
