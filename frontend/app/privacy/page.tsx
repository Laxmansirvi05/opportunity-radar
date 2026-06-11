import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | Opportunity Radar'
}

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      <header className="w-full top-0 sticky z-50 bg-surface border-b border-outline-variant">
        <div className="flex justify-between items-center h-16 px-gutter max-w-container-max mx-auto">
          <div className="flex items-center gap-xl">
            <Link href="/" className="font-headline-md text-headline-md font-bold text-primary cursor-pointer active:scale-95 transition-transform">
              Opportunity Radar
            </Link>
          </div>
          <div className="flex items-center gap-md">
            <Link href="/dashboard" className="font-label-md text-label-md px-md py-sm border border-outline-variant rounded hover:bg-surface-container-low transition-colors">Back to App</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-container-max mx-auto px-gutter py-xl w-full">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-xl">
          {/* Main Content Area */}
          <article className="md:col-span-9 md:col-start-3">
            <header className="mb-xl border-b border-outline-variant pb-lg">
              <h1 className="font-display text-display mb-sm">Privacy Policy</h1>
              <div className="flex items-center gap-md">
                <p className="font-body-md text-body-md text-on-surface-variant">Last Updated: October 24, 2026</p>
                <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
                <p className="font-body-md text-body-md text-on-surface-variant">Version 1.0.0</p>
              </div>
            </header>

            <div className="space-y-xl">
              <section className="bg-surface-container-lowest border border-outline-variant p-lg rounded-lg">
                <p className="font-body-lg text-body-lg leading-relaxed text-on-surface">
                  At Opportunity Radar, we are committed to being transparent about how we collect, use, and protect your personal information. This Privacy Policy explains our practices and the choices you can make about the way your data is handled while using our career advancement platform.
                </p>
              </section>

              <section className="scroll-mt-24" id="information-collected">
                <div className="flex items-center gap-sm mb-md">
                  <span className="material-symbols-outlined text-primary">inventory_2</span>
                  <h2 className="font-headline-md text-headline-md">Information Collected</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                  <div className="p-md bg-surface border border-outline-variant rounded-lg">
                    <h4 className="font-headline-sm text-headline-sm mb-xs">Direct Submissions</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">Profile information including name, education history, resume details, and career interests that you explicitly provide.</p>
                  </div>
                  <div className="p-md bg-surface border border-outline-variant rounded-lg">
                    <h4 className="font-headline-sm text-headline-sm mb-xs">Automated Data</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">Technical information like IP addresses, browser types, and platform interaction logs collected via automated systems.</p>
                  </div>
                  <div className="p-md bg-surface border border-outline-variant rounded-lg">
                    <h4 className="font-headline-sm text-headline-sm mb-xs">Resume Storage</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">We securely host any uploaded PDF resumes exclusively for your personal use and job applications.</p>
                  </div>
                </div>
              </section>

              <section className="scroll-mt-24" id="data-usage">
                <div className="flex items-center gap-sm mb-md">
                  <span className="material-symbols-outlined text-primary">data_usage</span>
                  <h2 className="font-headline-md text-headline-md">How We Use Your Data</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                  <div className="md:col-span-2 p-lg bg-primary-container text-on-primary-container rounded-xl flex flex-col justify-between">
                    <div>
                      <h4 className="font-headline-sm text-headline-sm mb-sm">Opportunity Matching</h4>
                      <p className="font-body-md text-body-md opacity-90">We use your professional interests and educational background to power our radar algorithms, identifying internships and fellowships that align perfectly with your trajectory.</p>
                    </div>
                  </div>
                  <div className="p-lg bg-secondary-fixed text-on-secondary-fixed rounded-xl">
                    <h4 className="font-headline-sm text-headline-sm mb-sm">Verification</h4>
                    <p className="font-body-md text-body-md">Ensuring the legitimacy of applications and student statuses to maintain platform integrity.</p>
                  </div>
                  <div className="p-lg bg-surface-container-high rounded-xl border border-outline-variant">
                    <h4 className="font-headline-sm text-headline-sm mb-sm">Communication</h4>
                    <p className="font-body-md text-body-md">Sending alerts for upcoming deadlines and new opportunities that match your specific tracker settings.</p>
                  </div>
                  <div className="md:col-span-2 p-lg bg-surface rounded-xl border border-outline-variant">
                    <h4 className="font-headline-sm text-headline-sm mb-sm">Product Improvement</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">Analyzing aggregated usage patterns to refine our search features and dashboard UI for a faster student experience.</p>
                  </div>
                </div>
              </section>

              <section className="scroll-mt-24" id="security">
                <div className="flex items-center gap-sm mb-md">
                  <span className="material-symbols-outlined text-primary">shield</span>
                  <h2 className="font-headline-md text-headline-md">Security Standards</h2>
                </div>
                <div className="p-lg bg-surface border border-outline-variant rounded-lg space-y-md">
                  <p className="font-body-lg text-body-lg">We employ industry-standard encryption protocols (TLS 1.3) for all data in transit and AES-256 for data at rest. Our systems are regularly audited for vulnerabilities to ensure your professional data remains private and protected.</p>
                </div>
              </section>

              <section className="scroll-mt-24" id="data-deletion">
                <div className="flex items-center gap-sm mb-md">
                  <span className="material-symbols-outlined text-primary">delete_forever</span>
                  <h2 className="font-headline-md text-headline-md">Self-Service Account Deletion</h2>
                </div>
                <div className="p-lg bg-surface border border-outline-variant rounded-lg space-y-md">
                  <p className="font-body-lg text-body-lg">You have full control over your data. You may permanently delete your account at any time from the Settings page. This will immediately and permanently erase your profile, saved opportunities, trackers, resumes, and notification settings from our database.</p>
                </div>
              </section>
            </div>
          </article>
        </div>
      </main>

      <footer className="w-full py-xl mt-auto bg-surface border-t border-outline-variant">
        <div className="flex flex-col md:flex-row justify-between items-center px-gutter max-w-container-max mx-auto gap-lg">
          <div className="flex flex-col items-center md:items-start gap-xs">
            <span className="font-label-md text-label-md font-bold text-primary">Opportunity Radar</span>
            <p className="font-label-sm text-label-sm text-on-surface-variant opacity-80">© 2026 Opportunity Radar</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
