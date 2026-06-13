import { Hero } from '@/components/landing/hero'
import { TrustBar } from '@/components/landing/trust-bar'
import { HowItWorks } from '@/components/landing/how-it-works'
import { OpportunityUniverse } from '@/components/landing/opportunity-universe'
import { ApplicationTracker } from '@/components/landing/application-tracker'
import { DeadlineTracker } from '@/components/landing/deadline-tracker'
import { PlatformBenefits } from '@/components/landing/platform-benefits'
import { WhyRadar } from '@/components/landing/why-radar'
import { Faq } from '@/components/landing/faq'
import { FinalCta } from '@/components/landing/final-cta'
import { SiteFooter } from '@/components/landing/site-footer'

export default function LandingPage() {
  return (
    <main className="hero-theme relative bg-background text-foreground">
      <Hero />
      <TrustBar />
      <HowItWorks />
      <OpportunityUniverse />
      <ApplicationTracker />
      <DeadlineTracker />
      <PlatformBenefits />
      <WhyRadar />
      <Faq />
      <FinalCta />
      <SiteFooter />
    </main>
  )
}
