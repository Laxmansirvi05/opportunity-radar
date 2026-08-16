import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service | Opportunity Radar'
}

const SECTIONS = [
  { id: 'introduction', label: '1. Introduction' },
  { id: 'eligibility', label: '2. Eligibility' },
  { id: 'account-usage', label: '3. Account Usage' },
  { id: 'ai-features', label: '4. AI Features & Their Limits' },
  { id: 'community-guidelines', label: '5. Community Guidelines' },
  { id: 'content-ownership', label: '6. Content & Ownership' },
  { id: 'third-party-listings', label: '7. Third-Party Opportunities & Links' },
  { id: 'acceptable-use', label: '8. Acceptable Use' },
  { id: 'data-and-termination', label: '9. Data Ownership & Termination' },
  { id: 'disclaimers', label: '10. Disclaimers' },
  { id: 'liability', label: '11. Limitation of Liability' },
  { id: 'notifications', label: '12. Notifications' },
  { id: 'changes-to-terms', label: '13. Changes to These Terms' },
  { id: 'governing-law', label: '14. Governing Law' },
  { id: 'contact', label: '15. Contact' },
]

export default function TermsOfServicePage() {
  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
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
        <div className="flex flex-col md:flex-row gap-10 relative">
          {/* Table of Contents */}
          <nav aria-label="Table of contents" className="hidden md:block w-64 shrink-0">
            <div className="sticky top-24 flex flex-col gap-1 border-l border-outline-variant pl-4">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Contents</p>
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

          <div className="flex-grow max-w-3xl">
            <header className="mb-10">
              <span className="inline-block px-2 py-1 bg-secondary-container text-on-secondary-container font-label-sm text-label-sm rounded-full mb-4 uppercase tracking-wider">Effective Document</span>
              <h2 className="font-display text-display text-on-surface mb-4">Terms of Service</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
                Please read these Terms of Service carefully before using Opportunity Radar. By accessing or using our platform, you agree to be bound by these terms and our{' '}
                <Link href="/privacy" className="text-primary underline underline-offset-2">Privacy Policy</Link>. If you do not agree, you must not access the service.
              </p>
              <p className="font-label-sm text-label-sm text-on-surface-variant mt-3">Last Updated: August 16, 2026</p>
            </header>
            <article className="legal-content font-body-md text-body-md text-on-surface-variant leading-relaxed space-y-10">
              <section id="introduction" className="scroll-mt-24">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">1. Introduction</h2>
                <p>Opportunity Radar provides a platform for students and early-career job seekers to discover opportunities, build and score resumes with AI, practice interviews, track applications, and connect with other students through the Hub community. These terms govern your access to and use of every module of the Platform.</p>
              </section>

              <section id="eligibility" className="scroll-mt-24">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">2. Eligibility</h2>
                <p>You must be at least 13 years old to use Opportunity Radar. If you are under the age of majority in your jurisdiction, you confirm that a parent or guardian has reviewed and agreed to these terms on your behalf. By creating an account, you represent that all information you provide is accurate and that you have the legal capacity to enter into this agreement.</p>
              </section>

              <section id="account-usage" className="scroll-mt-24">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">3. Account Usage</h2>
                <p>To access most features of the platform, you must register for an account. You agree to provide accurate, current, and complete information during registration and to keep it up to date.</p>
                <ul className="list-disc pl-6 space-y-2 mb-4 mt-4">
                  <li>You are responsible for safeguarding your password and for all activity under your account.</li>
                  <li>You must notify us immediately at the contact below of any unauthorized use of your account.</li>
                  <li>Accounts are personal to you — one account per individual, not to be shared or transferred.</li>
                  <li>We may suspend or terminate accounts that violate these terms, misrepresent identity, or are used for anything other than genuine career-development purposes.</li>
                </ul>
              </section>

              <section id="ai-features" className="scroll-mt-24">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">4. AI Features & Their Limits</h2>
                <p>The AI Search, Resume Optimiser, ATS Checker, AI Assistant, and AI Mock Interview are decision-support tools, not guarantees of outcome. You understand and agree that:</p>
                <ul className="list-disc pl-6 space-y-2 mb-4 mt-4">
                  <li>AI-generated scores, suggestions, rewritten resumes, and interview feedback are produced by third-party language models and may contain errors, omissions, or inaccuracies — always review AI output before relying on or submitting it.</li>
                  <li>An ATS score or "match" percentage is an estimate, not a promise of interview or hire outcomes with any employer or applicant tracking system.</li>
                  <li>You remain solely responsible for the accuracy and truthfulness of any resume, application, or message you send to a third party, whether AI-assisted or not.</li>
                  <li>Content you submit to AI features (resumes, job descriptions, interview audio, chat messages) is processed as described in our{' '}
                    <Link href="/privacy#ai-processing" className="text-primary underline underline-offset-2">Privacy Policy</Link>.</li>
                </ul>
              </section>

              <section id="community-guidelines" className="scroll-mt-24">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">5. Community Guidelines</h2>
                <p>Our platform thrives on mutual respect. In the Hub and anywhere else you interact with other students, you agree not to:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                  <div className="p-4 border border-outline-variant rounded-xl flex gap-2">
                    <span className="material-symbols-outlined text-error">block</span>
                    <div>
                      <p className="font-label-md text-label-md font-bold text-on-surface mb-0">Harassment</p>
                      <p className="font-label-sm text-label-sm">Post content that is harmful, threatening, or abusive toward other students.</p>
                    </div>
                  </div>
                  <div className="p-4 border border-outline-variant rounded-xl flex gap-2">
                    <span className="material-symbols-outlined text-error">warning</span>
                    <div>
                      <p className="font-label-md text-label-md font-bold text-on-surface mb-0">Misinformation</p>
                      <p className="font-label-sm text-label-sm">Deliberately post false scholarship deadlines, fake internship links, or impersonate a real organization.</p>
                    </div>
                  </div>
                  <div className="p-4 border border-outline-variant rounded-xl flex gap-2">
                    <span className="material-symbols-outlined text-error">shield_person</span>
                    <div>
                      <p className="font-label-md text-label-md font-bold text-on-surface mb-0">Spam & Solicitation</p>
                      <p className="font-label-sm text-label-sm">Send unsolicited advertising, referral schemes, or repeated off-topic messages.</p>
                    </div>
                  </div>
                  <div className="p-4 border border-outline-variant rounded-xl flex gap-2">
                    <span className="material-symbols-outlined text-error">no_photography</span>
                    <div>
                      <p className="font-label-md text-label-md font-bold text-on-surface mb-0">Inappropriate Content</p>
                      <p className="font-label-sm text-label-sm">Share images or text that are explicit, illegal, or otherwise unsuitable for a student community.</p>
                    </div>
                  </div>
                </div>
                <p>Messages and images you post in the Hub are visible to other signed-in students. You may edit or delete your own messages at any time; we may remove content or restrict accounts that violate these guidelines, with or without notice depending on severity.</p>
              </section>

              <section id="content-ownership" className="scroll-mt-24">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">6. Content & Ownership</h2>
                <p>You retain ownership of the content you create — your resumes, profile information, and Hub messages. By posting in the Hub, you grant other users of the Platform a license to view that content as part of normal use of the community feature. You grant us the license necessary to store, process, and display your content in order to operate the Platform and the AI features you use. The Opportunity Radar name, logo, and platform design are our property and may not be copied or reused without permission.</p>
              </section>

              <section id="third-party-listings" className="scroll-mt-24">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">7. Third-Party Opportunities & Links</h2>
                <p>Opportunity listings, certification catalogue entries, and external links on the Platform are aggregated from third-party sources (employers, certification providers, and public listing platforms). We do not control, and are not responsible for, the content, accuracy, availability, or application process of any third-party listing. Always verify deadlines and requirements directly with the listing source before applying. A certification or course shown on the Platform is issued by, and remains the property of, its original provider — we display it as a directory entry, not as our own credential.</p>
              </section>

              <section id="acceptable-use" className="scroll-mt-24">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">8. Acceptable Use</h2>
                <p>You agree not to: attempt to gain unauthorized access to other accounts or our systems; scrape, bulk-download, or reverse-engineer the Platform or its data; use automated tools to abuse AI features (e.g. spamming requests); upload malware; or use the Platform for any unlawful purpose.</p>
              </section>

              <section id="data-and-termination" className="scroll-mt-24">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">9. Data Ownership & Termination</h2>
                <p>You retain full ownership of your data. You may terminate your account at any time using the self-service deletion option in Settings. Upon deletion, your profile, resumes, and tracked opportunities are permanently and immediately removed from our active databases, as described in our{' '}
                  <Link href="/privacy#data-deletion" className="text-primary underline underline-offset-2">Privacy Policy</Link>. We may also suspend or terminate your access for a violation of these terms.</p>
              </section>

              <section id="disclaimers" className="scroll-mt-24">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">10. Disclaimers</h2>
                <p>Opportunity Radar is provided "as is" and "as available," without warranties of any kind, express or implied. We do not guarantee that the Platform will be uninterrupted, error-free, or that any opportunity, certification, or AI-generated result will meet your expectations or result in an offer, admission, or certification outcome.</p>
              </section>

              <section id="liability" className="scroll-mt-24">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">11. Limitation of Liability</h2>
                <p>To the maximum extent permitted by law, Opportunity Radar and its team are not liable for any indirect, incidental, or consequential damages arising from your use of the Platform, including missed opportunities, application outcomes, or reliance on AI-generated content. Nothing in these terms limits liability that cannot legally be limited.</p>
              </section>

              <section id="notifications" className="scroll-mt-24">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">12. Notifications</h2>
                <p>By opting into Email Alerts, you consent to receive platform updates and opportunity matches. You may opt out at any time via Settings. Account-security and legally-required notices may still be sent regardless of this preference.</p>
              </section>

              <section id="changes-to-terms" className="scroll-mt-24">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">13. Changes to These Terms</h2>
                <p>We may update these Terms as the Platform evolves. We'll update the "Last Updated" date above when we do, and for material changes, we'll make a reasonable effort to notify you in-app. Continuing to use the Platform after a change takes effect constitutes acceptance of the updated terms.</p>
              </section>

              <section id="governing-law" className="scroll-mt-24">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">14. Governing Law</h2>
                <p>These terms are governed by the laws of India, without regard to conflict-of-law principles. Any dispute arising from these terms or your use of the Platform will be subject to the exclusive jurisdiction of the courts located in India.</p>
              </section>

              <section id="contact" className="scroll-mt-24">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">15. Contact</h2>
                <p>Questions about these Terms? Reach us at{' '}
                  <a href="mailto:support@opportunityradar.com" className="text-primary underline underline-offset-2">support@opportunityradar.com</a>{' '}
                  or visit our <Link href="/support" className="text-primary underline underline-offset-2">Support Center</Link>.
                </p>
              </section>
            </article>
          </div>
        </div>
      </main>

      <footer className="w-full py-10 mt-auto bg-surface border-t border-outline-variant">
        <div className="flex flex-col md:flex-row justify-between items-center px-gutter max-w-container-max mx-auto gap-6">
          <div className="mb-4 md:mb-0">
            <span className="font-label-md text-label-md font-bold text-primary">Opportunity Radar</span>
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">© 2026 Opportunity Radar</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/support" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
