'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { readPendingVerificationEmail } from '@/features/auth/lib/pending-verification'

/**
 * The "check your inbox" step after signing up.
 *
 * This page used to be a mock: its "Resend Email" button called a local
 * `simulateVerification()` that flipped straight to an "Email verified
 * successfully" screen without sending anything, "Change email" did nothing at
 * all, and it advertised a made-up "2,400+ students" figure. Nothing linked to
 * it either. It now performs a real resend and is where signup sends people.
 *
 * There is deliberately no "verified" state here: clicking the link in the
 * email hits /auth/callback, which establishes the session server-side and
 * redirects on. This tab never observes that, so claiming it did would be the
 * same lie in a new form.
 */

/** Supabase rate-limits verification email sends; this keeps us clear of it. */
const RESEND_COOLDOWN_SECONDS = 60

/**
 * The address is written before this page is navigated to and never changes
 * while it is open, so there is nothing to subscribe to. Reading it through
 * useSyncExternalStore (rather than an effect) keeps the server render and the
 * hydration pass agreed on `null` and only then swaps in the stored value.
 */
const subscribeToNothing = () => () => {}
const noEmailOnServer = () => null

export default function VerifyEmailPage() {
  const email = useSyncExternalStore(
    subscribeToNothing,
    readPendingVerificationEmail,
    noEmailOnServer
  )
  const [isSending, setIsSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [sentAt, setSentAt] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN_SECONDS)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCooldown((seconds) => {
        if (seconds <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return seconds - 1
      })
    }, 1000)
  }, [])

  async function handleResend() {
    if (!email || isSending || cooldown > 0) return

    setIsSending(true)
    setErrorMessage(null)
    setSentAt(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          // Matches the redirect signupAction registers, so a resent link
          // behaves identically to the original.
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        if (error.message.toLowerCase().includes('rate limit')) {
          setErrorMessage('Too many requests. Please wait a minute and try again.')
        } else if (error.message.toLowerCase().includes('already confirmed')) {
          setErrorMessage('This email is already verified — you can log in.')
        } else {
          setErrorMessage('Could not resend the email. Please try again shortly.')
        }
        return
      }

      setSentAt(Date.now())
      startCooldown()
    } catch {
      setErrorMessage('A network error occurred. Please check your connection.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      <header className="w-full h-16 flex items-center justify-center border-b border-outline-variant bg-surface">
        <Link
          href="/"
          className="font-headline-md text-headline-md font-bold text-primary tracking-tight"
        >
          Opportunity Radar
        </Link>
      </header>

      <main className="flex-grow flex items-center justify-center px-margin-mobile py-10">
        <div className="max-w-[480px] w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-10 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-primary-container/10 text-primary rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined !text-[32px]">mark_email_read</span>
            </div>

            <h1 className="font-headline-lg text-headline-lg mb-2 text-on-surface">
              Check your inbox
            </h1>

            <p className="font-body-md text-body-md text-on-surface-variant mb-8">
              {email ? (
                <>
                  We sent a verification link to{' '}
                  <span className="text-on-surface font-semibold break-all">{email}</span>. Click
                  it to activate your account.
                </>
              ) : (
                <>
                  We sent a verification link to your email address. Click it to activate your
                  account.
                </>
              )}
            </p>

            {errorMessage && (
              <div
                role="alert"
                className="w-full mb-4 p-3 bg-error/10 border border-error/20 rounded-lg flex items-start gap-2 text-error text-left"
              >
                <span className="material-symbols-outlined text-[18px]">error</span>
                <p className="font-body-sm text-body-sm mt-0.5">{errorMessage}</p>
              </div>
            )}

            {sentAt && !errorMessage && (
              <div
                role="status"
                className="w-full mb-4 p-3 bg-secondary/10 border border-secondary/20 rounded-lg flex items-start gap-2 text-secondary text-left"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <p className="font-body-sm text-body-sm mt-0.5">
                  Verification email sent. It can take a minute to arrive.
                </p>
              </div>
            )}

            <div className="w-full space-y-4">
              {/* Without an address in this tab there is nothing to resend to —
                  offer signing up again rather than a button that cannot work. */}
              {email && (
                <button
                  onClick={handleResend}
                  disabled={isSending || cooldown > 0}
                  className="w-full py-4 px-6 bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {isSending ? (
                    <span className="material-symbols-outlined animate-spin text-[20px]">
                      progress_activity
                    </span>
                  ) : cooldown > 0 ? (
                    <span>Resend in {cooldown}s</span>
                  ) : (
                    <span>Resend email</span>
                  )}
                </button>
              )}

              <Link
                href="/signup"
                className="w-full py-4 px-6 border border-outline-variant bg-surface text-on-surface-variant font-label-md text-label-md rounded-lg hover:bg-surface-container-low active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center"
              >
                Use a different email
              </Link>
            </div>

            <div className="mt-10 pt-6 border-t border-outline-variant w-full">
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Already verified?{' '}
                <Link href="/login" className="text-primary font-semibold hover:underline">
                  Log in
                </Link>
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                Nothing in your inbox? Check your spam folder before resending.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full py-10 bg-surface border-t border-outline-variant">
        <div className="max-w-container-max mx-auto px-gutter flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="font-label-md text-label-md font-bold text-primary">
            Opportunity Radar
          </div>
          <div className="flex gap-6">
            <Link
              href="/terms"
              className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/support"
              className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
            >
              Support
            </Link>
          </div>
          <div className="font-label-sm text-label-sm text-on-surface-variant opacity-80">
            © 2026 Opportunity Radar
          </div>
        </div>
      </footer>
    </div>
  )
}
