'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function ForgotPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    
    // Integrate with Supabase reset password later
    setTimeout(() => {
      setIsLoading(false)
      setIsSuccess(true)
    }, 800)
  }

  function resetView() {
    setIsSuccess(false)
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center">
      {/* Header Section (Minimal Branding) */}
      <header className="w-full flex justify-center py-xl bg-surface border-b border-outline-variant">
        <div className="flex items-center gap-sm">
          <div className="w-8 h-8 bg-primary-container rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
          </div>
          <span className="font-headline-md text-headline-md font-bold text-primary">Opportunity Radar</span>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-grow flex items-center justify-center w-full px-margin-mobile relative">
        {/* Recovery Card */}
        <div className={`max-w-[440px] w-full bg-surface-container-lowest p-xl rounded-xl border transition-all duration-300 ${isSuccess ? 'border-secondary/30' : 'border-outline-variant'}`}>
          
          {/* Step 1: Request Reset */}
          {!isSuccess && (
            <div className="space-y-lg">
              <div className="text-center mb-xl">
                <h1 className="font-headline-lg text-headline-lg text-on-surface mb-sm">Forgot password?</h1>
                <p className="font-body-md text-body-md text-on-surface-variant">No worries, it happens. Enter the email address associated with your account and we&apos;ll send you a recovery link.</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-md">
                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant block ml-xs" htmlFor="email">Email Address</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline text-[20px]">mail</span>
                    <input 
                      id="email" 
                      type="email" 
                      required 
                      placeholder="name@university.edu" 
                      className="w-full pl-xl pr-md py-md bg-surface border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none" 
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full py-md px-lg bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary-container active:scale-[0.98] transition-all flex items-center justify-center gap-sm shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
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
              <div className="pt-lg flex flex-col items-center gap-md border-t border-outline-variant">
                <Link href="/login" className="flex items-center gap-xs font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  <span>Back to Log In</span>
                </Link>
              </div>
            </div>
          )}

          {/* Step 2: Success State */}
          {isSuccess && (
            <div className="space-y-lg text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-lg">
                <span className="material-symbols-outlined text-secondary text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface mb-sm">Check your inbox</h2>
                <p className="font-body-md text-body-md text-on-surface-variant">We&apos;ve sent a password reset link to your email. Please click the link to create a new password.</p>
              </div>
              <div className="bg-surface-container-low p-md rounded-lg text-left">
                <p className="font-label-sm text-label-sm text-on-surface-variant mb-xs">Didn&apos;t receive the email?</p>
                <p className="font-body-md text-body-md text-on-surface">Check your spam folder or try again in <span className="font-bold text-primary">59s</span></p>
              </div>
              <button 
                onClick={resetView}
                className="w-full py-md border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-container-high transition-all cursor-pointer"
              >
                Resend link
              </button>
              <div className="pt-lg">
                <Link href="/login" className="flex items-center justify-center gap-xs font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
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
      <footer className="w-full py-xl mt-auto border-t border-outline-variant bg-surface">
        <div className="max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-center px-gutter gap-md">
          <p className="font-label-sm text-label-sm text-on-surface-variant">© 2024 Opportunity Radar. All rights reserved.</p>
          <div className="flex gap-lg">
            <Link href="#" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Terms of Service</Link>
            <Link href="#" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="#" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
