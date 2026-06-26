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
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">
                  Did not receive anything? <span className="text-primary font-semibold">Check your spam folder</span> or try again in 5 minutes.
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
                <div className="flex -space-x-2" aria-hidden="true">
                  <div className="w-8 h-8 rounded-full border-2 border-surface-container-lowest bg-primary/20 text-primary font-semibold text-xs flex items-center justify-center">A</div>
                  <div className="w-8 h-8 rounded-full border-2 border-surface-container-lowest bg-secondary/20 text-secondary font-semibold text-xs flex items-center justify-center">R</div>
                  <div className="w-8 h-8 rounded-full border-2 border-surface-container-lowest bg-tertiary/20 text-tertiary font-semibold text-xs flex items-center justify-center">S</div>
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
            <Link href="/terms" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/support" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Support</Link>
          </div>
          <div className="font-label-sm text-label-sm text-on-surface-variant opacity-80">
            © 2026 Opportunity Radar
          </div>
        </div>
      </footer>
    </div>
  )
}
