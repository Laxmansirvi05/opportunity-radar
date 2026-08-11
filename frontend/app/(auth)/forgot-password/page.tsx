'use client'

import Link from 'next/link'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ForgotPasswordContent() {
  const searchParams = useSearchParams()
  const isVerified = searchParams.get('verified') === 'true'

  const [isSuccess, setIsSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  const supabase = createClient()

  async function handleSendResetLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)
    
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string

    if (!email) {
      setErrorMessage('Please enter an email address.')
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })

      if (error) {
        // Map common Supabase errors to user-friendly messages
        if (error.message.includes('rate limit')) {
          setErrorMessage('Too many requests. Please try again later.')
        } else {
          setErrorMessage('Failed to send reset link. Please verify your email and try again.')
        }
      } else {
        setIsSuccess(true)
      }
    } catch (err) {
      setErrorMessage('A network error occurred. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUpdatePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.')
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        if (error.message.includes('New password should be different')) {
          setErrorMessage('New password must be different from the old password.')
        } else if (error.message.includes('weak')) {
          setErrorMessage('Password is too weak. Please use a stronger password.')
        } else {
          setErrorMessage('Failed to update password. Your reset link may have expired.')
        }
      } else {
        setIsSuccess(true) // Reusing success state for the final confirmation
      }
    } catch (err) {
      setErrorMessage('A network error occurred. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function resetView() {
    setIsSuccess(false)
    setErrorMessage(null)
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center">
      <header className="w-full flex justify-center py-10 bg-surface border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-container rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
          </div>
          <span className="font-headline-md text-headline-md font-bold text-primary">Opportunity Radar</span>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center w-full px-margin-mobile relative">
        <div className={`max-w-[440px] w-full bg-surface-container-lowest p-10 rounded-xl border transition-all duration-300 ${isSuccess ? 'border-secondary/30' : 'border-outline-variant'}`}>
          
          {/* Step 1: Request Reset (if not verified and not successful) */}
          {!isVerified && !isSuccess && (
            <div className="space-y-6">
              <div className="text-center mb-10">
                <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Forgot password?</h1>
                <p className="font-body-md text-body-md text-on-surface-variant">No worries, it happens. Enter the email address associated with your account and we&apos;ll send you a recovery link.</p>
              </div>
              <form onSubmit={handleSendResetLink} className="space-y-4">
                {errorMessage && (
                  <div className="p-2 bg-error/10 border border-error/20 rounded-lg flex items-start gap-1 text-error">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    <p className="font-body-sm text-body-sm mt-0.5">{errorMessage}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="font-label-md text-label-md text-on-surface-variant block ml-1" htmlFor="email">Email Address</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px]">mail</span>
                    <input 
                      id="email" 
                      name="email"
                      type="email" 
                      required 
                      placeholder="name@university.edu" 
                      className="w-full pl-10 pr-4 py-4 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none" 
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full py-4 px-6 bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary-container active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  ) : (
                    <>
                      <span>Send Reset Link</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
              <div className="pt-6 flex flex-col items-center gap-4 border-t border-outline-variant">
                <Link href="/login" className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  <span>Back to Log In</span>
                </Link>
              </div>
            </div>
          )}

          {/* Step 2: Set New Password (if verified and not successful) */}
          {isVerified && !isSuccess && (
            <div className="space-y-6">
              <div className="text-center mb-10">
                <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Reset password</h1>
                <p className="font-body-md text-body-md text-on-surface-variant">Enter a new, strong password below.</p>
              </div>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                {errorMessage && (
                  <div className="p-2 bg-error/10 border border-error/20 rounded-lg flex items-start gap-1 text-error">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    <p className="font-body-sm text-body-sm mt-0.5">{errorMessage}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="font-label-md text-label-md text-on-surface-variant block ml-1" htmlFor="password">New Password</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px]">lock</span>
                    <input 
                      id="password" 
                      name="password"
                      type="password" 
                      required 
                      minLength={6}
                      placeholder="Enter new password" 
                      className="w-full pl-10 pr-4 py-4 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none" 
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full py-4 px-6 bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary-container active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Step 3: Success State (Shared for Reset Link Sent OR Password Updated) */}
          {isSuccess && (
            <div className="space-y-6 text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-secondary text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface mb-2">
                  {isVerified ? 'Password updated' : 'Check your inbox'}
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {isVerified 
                    ? 'Your password has been successfully updated. You can now log in.' 
                    : 'We\'ve sent a password reset link to your email. Please click the link to create a new password.'}
                </p>
              </div>
              {!isVerified && (
                <>
                  <div className="bg-surface-container-low p-4 rounded-lg text-left">
                    <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Didn&apos;t receive the email?</p>
                    <p className="font-body-md text-body-md text-on-surface">Check your spam folder or try again.</p>
                  </div>
                  <button 
                    onClick={resetView}
                    className="w-full py-4 border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-container-high transition-all cursor-pointer"
                  >
                    Resend link
                  </button>
                </>
              )}
              <div className="pt-6">
                <Link href="/login" className="flex items-center justify-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  <span>Return to Log In</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Decorative Aesthetic Background Elements */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-40">
          <div className="absolute -top-[10%] -right-[10%] w-[600px] h-[600px] rounded-full border-[1px] border-outline-variant/30"></div>
          <div className="absolute -top-[5%] -right-[5%] w-[500px] h-[500px] rounded-full border-[1px] border-outline-variant/40"></div>
          <div className="absolute top-[0%] right-[0%] w-[400px] h-[400px] rounded-full border-[1px] border-outline-variant/50"></div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-10 mt-auto border-t border-outline-variant bg-surface">
        <div className="max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-center px-gutter gap-4">
          <p className="font-label-sm text-label-sm text-on-surface-variant">© 2026 Opportunity Radar</p>
          <div className="flex gap-6">
            <Link href="/terms" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/support" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  )
}
