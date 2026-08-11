import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service | Opportunity Radar'
}

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
          <div className="flex-grow max-w-3xl mx-auto">
            <header className="mb-10">
              <span className="inline-block px-2 py-1 bg-secondary-container text-on-secondary-container font-label-sm text-label-sm rounded-full mb-4 uppercase tracking-wider">Effective Document</span>
              <h2 className="font-display text-display text-on-surface mb-4">Terms of Service</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
                Please read these Terms of Service carefully before using Opportunity Radar. By accessing or using our platform, you agree to be bound by these terms and our Privacy Policy. If you do not agree, you must not access the service.
              </p>
            </header>
            <article className="legal-content font-body-md text-body-md text-on-surface-variant leading-relaxed space-y-10">
              <section id="introduction">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">1. Introduction</h2>
                <p>Opportunity Radar provides a platform for students and career seekers to track internships, scholarships, and professional milestones. These terms govern your access to the suite of tools provided under the Student Workspace and Career Advancement modules.</p>
              </section>
              <section id="account-usage">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">2. Account Usage</h2>
                <p>To access certain features of the platform, you must register for an account. You agree to provide accurate, current, and complete information during the registration process.</p>
                <ul className="list-disc pl-6 space-y-2 mb-4 mt-4">
                  <li>You are responsible for safeguarding your password.</li>
                  <li>You must notify us immediately of any unauthorized use of your account.</li>
                  <li>Accounts are limited to one per individual user.</li>
                </ul>
              </section>
              <section id="community-guidelines">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">3. Community Guidelines</h2>
                <p>Our platform thrives on mutual respect. You agree not to use Opportunity Radar to:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                  <div className="p-4 border border-outline-variant rounded-xl flex gap-2">
                    <span className="material-symbols-outlined text-error">block</span>
                    <div>
                      <p className="font-label-md text-label-md font-bold text-on-surface mb-0">Harassment</p>
                      <p className="font-label-sm text-label-sm">Post content that is harmful, threatening, or abusive to other students.</p>
                    </div>
                  </div>
                  <div className="p-4 border border-outline-variant rounded-xl flex gap-2">
                    <span className="material-symbols-outlined text-error">warning</span>
                    <div>
                      <p className="font-label-md text-label-md font-bold text-on-surface mb-0">Misinformation</p>
                      <p className="font-label-sm text-label-sm">Deliberately post false scholarship deadlines or fake internship links.</p>
                    </div>
                  </div>
                </div>
              </section>

              <section id="data-and-termination">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">4. Data Ownership & Termination</h2>
                <p>You retain full ownership of your data. You may terminate your account at any time using the self-service deletion option in your Account Settings. Upon deletion, your profile, resumes, and tracked opportunities are permanently and immediately removed from our active databases.</p>
              </section>

              <section id="notifications">
                <h2 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-1 mb-4">5. Notifications</h2>
                <p>By opting into Email Alerts, you consent to receive platform updates and opportunity matches. You may opt out at any time via your Account Settings.</p>
              </section>
            </article>
          </div>
        </div>
      </main>

      <footer className="w-full py-10 mt-auto bg-surface border-t border-outline-variant">
        <div className="flex flex-col md:flex-row justify-between items-center px-gutter max-w-container-max mx-auto">
          <div className="mb-4 md:mb-0">
            <span className="font-label-md text-label-md font-bold text-primary">Opportunity Radar</span>
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">© 2026 Opportunity Radar</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
