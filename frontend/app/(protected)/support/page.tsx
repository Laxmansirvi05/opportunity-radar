import Link from 'next/link'

export const metadata = {
  title: 'Support & Info | Opportunity Radar'
}

export default function SupportPage() {
  return (
    <div className="flex flex-col gap-10 max-w-3xl mx-auto w-full pb-16">
      <header className="mb-6">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-1">
          Support & Information
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">Get help and read our platform policies.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact */}
        <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <div className="w-12 h-12 bg-primary-container text-on-primary-container rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">contact_support</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-on-background font-bold mb-1">Contact Us</h3>
            <p className="text-sm text-on-surface-variant mb-4">Need help finding an opportunity or have an account issue? Reach out to our support team.</p>
            <a href="mailto:support@opportunityradar.com" className="inline-flex items-center gap-2 text-primary font-bold hover:underline">
              support@opportunityradar.com
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </a>
          </div>
        </div>

        {/* About */}
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

        {/* Privacy */}
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

        {/* Terms */}
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
  )
}
