'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function VerifyEmailPage() {
  const [isVerified, setIsVerified] = useState(false)

  // This is a simulation function for UI presentation purposes
  function simulateVerification() {
    setIsVerified(true)
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      {/* Top Navigation (Shell Rule: Suppressed for Transactional flow, but Logo included for Branding) */}
      <header className="w-full h-16 flex items-center justify-center border-b border-outline-variant bg-surface">
        <div className="font-headline-md text-headline-md font-bold text-primary tracking-tight">
          Opportunity Radar
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-margin-mobile">
        <div className="max-w-[480px] w-full bg-surface-container-lowest border border-outline-variant hover:border-primary transition-colors duration-300 rounded-xl p-xl shadow-sm overflow-hidden relative">

          {/* PENDING STATE */}
          {!isVerified && (
            <div className="flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-primary-container/10 text-primary rounded-full flex items-center justify-center mb-lg">
                <span className="material-symbols-outlined !text-[32px]">mark_email_read</span>
              </div>
              <h1 className="font-headline-lg text-headline-lg mb-sm text-on-surface">Check your inbox</h1>
              <p className="font-body-md text-body-md text-on-surface-variant mb-xl">
                We sent a verification link to your email. Please click the link to confirm your account.
              </p>

              <div className="w-full space-y-md">
                <button
                  onClick={simulateVerification}
                  className="w-full py-md px-lg bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-sm cursor-pointer"
                >
                  Resend Email
                </button>
                <button className="w-full py-md px-lg border border-outline-variant bg-surface text-on-surface-variant font-label-md text-label-md rounded-lg hover:bg-surface-container-low active:scale-[0.98] transition-all cursor-pointer">
                  Change email
                </button>
              </div>

              <div className="mt-xl pt-lg border-t border-outline-variant w-full">
                <p className="font-label-md text-label-md text-on-surface-variant">
                  Did not receive anything? <Link href="#" className="text-primary hover:underline font-semibold">Check your spam folder</Link> or try again in 5 minutes.
                </p>
              </div>
            </div>
          )}

          {/* VERIFIED STATE */}
          {isVerified && (
            <div className="flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
              <div className="relative mb-lg">
                <div className="w-16 h-16 bg-secondary-container text-on-secondary-container rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined !text-[32px]">verified</span>
                </div>
                {/* Sparkle decorations */}
                <div className="absolute -top-1 -right-1 text-secondary">
                  <span className="material-symbols-outlined !text-[16px]">spark</span>
                </div>
              </div>

              <h1 className="font-headline-lg text-headline-lg mb-sm text-on-surface">Email verified successfully</h1>
              <p className="font-body-md text-body-md text-on-surface-variant mb-xl">
                Your account is now fully active. You&apos;re ready to explore high-impact career opportunities.
              </p>

              <div className="w-full">
                <Link href="/dashboard" className="w-full flex justify-center py-md px-lg bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:brightness-110 active:scale-[0.98] transition-all">
                  Continue to Opportunity Radar
                </Link>
              </div>

              <div className="mt-xl flex flex-col items-center gap-md">
                <div className="flex -space-x-2">
                  <img alt="User profile" className="w-8 h-8 rounded-full border-2 border-surface-container-lowest object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBMtpUqmwmLI4bCqe5VUgcdwV7xs_9j5A0xbIrCgMlyuDXAcVWTln9tTEGwZDerc2StnDNysyts8zFs4hAtGfsEN_akPrMfO3mw4UkfwjIu6aqR1Z3uhiyn-wjQVF_VSS-pP9ErNUdSYZv2-9ZAXgNlDjohoNTcPa75jh6MMhVpIzXWy3foVcvSPhLQt4OI2OQSv3CH0GaVlnAkvrp5mBbPlHUdQhXBPJvhoR2AiCpF8L8jXCq1UHrLWL_pE45K3iCK3ba_4ZSiXIfZ" />
                  <img alt="User profile" className="w-8 h-8 rounded-full border-2 border-surface-container-lowest object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC4rU58TBwQBbcpzirolT3IhxiWlPrVNZuYeWjbHVykJwQ-dju6M46TS16fw1_poxfKi_C2po60Ho1K_7uTpjHVpIhoeAkrNv5OQjotk23Kx9mXQSAlcP-5szZnmHd-pUQuaAFVRhA2HGEqzBFFRjKkxzEE9iTV-nRwG-gX8EAhx9CUNeW1pLRUdit981mqiWjk0dKOxdhYGOBWtya8aCthRSxIEn5WpnvkefIqFkrhClduE-6zRztZXZSX9DWxQdkuml4sR15aTjJQ" />
                  <img alt="User profile" className="w-8 h-8 rounded-full border-2 border-surface-container-lowest object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAQwM39bgSzmaKdtPJ6CHcwVGJSFVEwQSaS0zZP4rok1z62k5Iu1QoEFsKgXnO5xGIN65n8KHFkCfO3QMNzrKB5xaUtx1RtiYJorZkSWra-WV1x8MM_vY3qx0F_aYDepk3qu_6UeH4q-2doCDDg1-DJyk4IO4yxYdEnysbs7J1aYlF7daLKMhfqpqkOHTbNdaKysmzhwpQSIAjY4wwdj1YHFWk0XhN1UbwxZaHMNtjZj3Kqwvzn-yYo5Rw2_OrQU2hpFV7yV4LT0WUO" />
                </div>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Join 2,400+ students already advancing their careers.</p>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Global Footer (Standard Link Row) */}
      <footer className="w-full py-xl bg-surface border-t border-outline-variant">
        <div className="max-w-container-max mx-auto px-gutter flex flex-col md:flex-row justify-between items-center gap-md">
          <div className="font-label-md text-label-md font-bold text-primary">Opportunity Radar</div>
          <div className="flex gap-lg">
            <Link href="#" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Terms of Service</Link>
            <Link href="#" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="#" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Support</Link>
          </div>
          <div className="font-label-sm text-label-sm text-on-surface-variant opacity-80">
            © 2026 Opportunity Radar
          </div>
        </div>
      </footer>
    </div>
  )
}
