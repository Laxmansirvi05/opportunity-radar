'use client'

import { useState } from 'react'
import { loginAction, signupAction, oauthLoginAction, resendVerificationEmailAction } from '@/features/auth/actions/auth-actions'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { safeNextPath } from '@/lib/auth/safe-next-path'
import { setPendingVerificationEmail } from '@/features/auth/lib/pending-verification'
import Link from 'next/link'
import { AuthRadar } from './auth-radar'
import { Turnstile } from '@marsidev/react-turnstile'

export function AuthExperience() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const callbackError = searchParams.get('error')

  // Where Proxy wanted to send the user before it bounced them to /login.
  // Only same-origin relative paths are honoured, so a crafted ?next= cannot
  // turn the login screen into an open redirect.
  const nextUrl = safeNextPath(searchParams.get('next'))

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(
    pathname === '/signup' ? 'signup' : 'login'
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = useState(false)
  const [error, setError] = useState<string | null>(callbackError)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const router = useRouter()

  async function handleLogin(formData: FormData) {
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const result = await loginAction(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        router.push(nextUrl)
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSignup(formData: FormData) {
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)
    setUnconfirmedEmail(null)
    try {
      const result = await signupAction(formData)
      if (result?.error === 'already_registered_unconfirmed') {
        setUnconfirmedEmail((result as any).email || (formData.get('email') as string))
        setError('This email is already registered but not confirmed.')
      } else if (result?.error) {
        setError(result.error)
      } else if (result?.needsEmailConfirmation) {
        // Hand the address to /verify-email so it can offer a real resend,
        // via storage rather than the URL — see pending-verification.ts.
        setPendingVerificationEmail((formData.get('email') as string) ?? '')
        router.push('/verify-email')
      } else {
        router.push(nextUrl)
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900 font-sans overflow-x-hidden">
      
      {/* LEFT SIDE: Visual & Branding */}
      {/* order-last on mobile: the illustration/headline used to stack above
          the form and push it below the fold on a typical viewport (UI-02).
          The form now renders first on narrow screens; lg:order-none
          restores the original left/right layout at the desktop breakpoint. */}
      <section className="relative flex flex-col justify-between w-full lg:w-[58%] p-6 lg:p-12 lg:pt-10 lg:pb-12 min-h-[50vh] lg:min-h-screen overflow-hidden order-last lg:order-none">
        {/* Subtle grid background */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: 0.4 }}></div>
        
        {/* SECTION 1: Logo */}
        <div className="hidden lg:flex items-center gap-3 relative z-50 self-start">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
          </div>
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Opportunity Radar</span>
        </div>

        {/* SECTION 2: Radar */}
        <div className="relative z-10 flex-1 flex justify-center items-center w-full min-h-[400px] lg:mb-6 pointer-events-none">
           <AuthRadar />
        </div>

        {/* SECTION 3: Headline and Description */}
        <div className="relative z-10 w-full max-w-[600px] text-center lg:text-left self-start mt-auto pt-8 lg:pt-[50px]">
          <h1 className="text-[2.5rem] lg:text-[3.5rem] font-extrabold tracking-tight text-slate-900 mb-4 leading-[1.15]">
            Your next opportunity <br className="hidden lg:block" />
            is <span className="text-primary">already</span> out there.
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-[480px] mx-auto lg:mx-0">
            Discover internships, jobs, hackathons, scholarships, competitions and research opportunities from one intelligent opportunity radar.
          </p>
        </div>

      </section>

      {/* RIGHT SIDE: Authentication Form */}
      <section className="relative flex flex-col justify-center items-center w-full lg:w-[42%] p-6 lg:p-12 lg:-ml-20 z-20">
        
        {/* Glassmorphism Card */}
        <div className="w-full max-w-[520px] bg-white/80 backdrop-blur-2xl border border-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] rounded-[32px] p-8 lg:p-14 relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none translate-x-1/2 -translate-y-1/2"></div>

          {/* Logo Mobile */}
          <div className="lg:hidden flex justify-center items-center gap-2 mb-8 relative z-10">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-md shadow-primary/20">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">Opportunity Radar</span>
          </div>

          {/* Toggle Header */}
          <div className="flex mb-8 border-b border-slate-200 relative z-10">
            <button 
              onClick={() => { setActiveTab('login'); setError(null); setSuccessMessage(null); }}
              className={`flex-1 pb-4 text-sm font-semibold transition-all duration-300 border-b-2 cursor-pointer ${activeTab === 'login' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Log In
            </button>
            <button 
              onClick={() => { setActiveTab('signup'); setError(null); setSuccessMessage(null); }}
              className={`flex-1 pb-4 text-sm font-semibold transition-all duration-300 border-b-2 cursor-pointer ${activeTab === 'signup' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Sign Up
            </button>
          </div>

          <div className="relative z-10">
            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium text-center border border-red-100 flex flex-col items-center gap-2">
                <p>{error}</p>
                {unconfirmedEmail && (
                  <button 
                    type="button" 
                    onClick={async () => {
                      setIsLoading(true);
                      setError(null);
                      setSuccessMessage(null);
                      try {
                        const fd = new FormData();
                        fd.append('email', unconfirmedEmail);
                        const res = await resendVerificationEmailAction(fd);
                        if (res.error) setError(res.error);
                        else {
                          setSuccessMessage('Verification email sent! Check your inbox.');
                          setUnconfirmedEmail(null);
                        }
                      } catch {
                        setError('Failed to resend email.');
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    className="mt-2 text-xs font-bold bg-red-100 text-red-800 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    Resend Verification Email
                  </button>
                )}
              </div>
            )}

            {successMessage && (
              <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium text-center border border-emerald-100">
                {successMessage}
              </div>
            )}

            {/* Social Auth Container */}
            <div className="mb-8">
              <button
                type="button"
                disabled={isOAuthLoading}
                onClick={async () => {
                  setIsOAuthLoading(true)
                  setError(null)
                  try {
                    const result = await oauthLoginAction('google', nextUrl)
                    if (result?.url) {
                      window.location.href = result.url
                      return
                    }
                    // The action resolved but gave back no redirect URL — a
                    // real, previously-silent failure mode: the button
                    // would just sit there with no feedback at all.
                    setError(result?.error || 'Could not start Google sign-in. Please try again.')
                  } catch {
                    setError('Could not start Google sign-in. Please try again.')
                  } finally {
                    setIsOAuthLoading(false)
                  }
                }}
                className="w-full h-12 flex items-center justify-center gap-3 px-6 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all active:scale-[0.98] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                aria-label="Continue with Google"
              >
                {isOAuthLoading ? (
                  <span className="material-symbols-outlined animate-spin text-[18px] text-slate-400">sync</span>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l2.85-2.22.83-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                {isOAuthLoading ? 'Redirecting to Google…' : 'Continue with Google'}
              </button>
            </div>

            <div className="relative flex items-center justify-center mb-8">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="mx-4 text-xs font-bold text-slate-400 bg-white px-2 uppercase tracking-widest">or</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Login Form */}
            {activeTab === 'login' && (
              <form action={handleLogin} className="space-y-5 flex flex-col">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-sm font-semibold text-slate-700 px-1" htmlFor="login-email">Email Address</label>
                  <input autoFocus required name="email" id="login-email" type="email" autoComplete="email" placeholder="name@university.edu" className="w-full h-12 px-4 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-sm placeholder:text-slate-400 bg-white" />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-sm font-semibold text-slate-700" htmlFor="login-password">Password</label>
                    <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">Forgot Password?</Link>
                  </div>
                  <div className="relative">
                    <input required name="password" id="login-password" type={showLoginPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" className="w-full h-12 px-4 pr-11 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-sm placeholder:text-slate-400 bg-white" />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((v) => !v)}
                      className="absolute right-0 top-0 h-12 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showLoginPassword}
                    >
                      <span className="material-symbols-outlined text-[20px]">{showLoginPassword ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>
                {turnstileSiteKey && (
                  <div className="flex justify-center my-4">
                    <Turnstile siteKey={turnstileSiteKey} />
                  </div>
                )}
                <button disabled={isLoading} type="submit" className="w-full h-12 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-[0.98] mt-4 flex items-center justify-center cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed">
                  {isLoading ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : 'Sign In'}
                </button>
              </form>
            )}

            {/* Signup Form */}
            {activeTab === 'signup' && (
              <form id="signup-form" action={handleSignup} className="space-y-5 flex flex-col">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-sm font-semibold text-slate-700 px-1" htmlFor="signup-name">Full Name</label>
                  <input autoFocus required name="name" id="signup-name" type="text" autoComplete="name" placeholder="Alex Student" className="w-full h-12 px-4 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-sm placeholder:text-slate-400 bg-white" />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-sm font-semibold text-slate-700 px-1" htmlFor="signup-email">University Email</label>
                  <input required name="email" id="signup-email" type="email" autoComplete="email" placeholder="alex@university.edu" className="w-full h-12 px-4 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-sm placeholder:text-slate-400 bg-white" />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-sm font-semibold text-slate-700 px-1" htmlFor="signup-password">Create Password</label>
                  <div className="relative">
                    <input required minLength={6} name="password" id="signup-password" type={showSignupPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 6 characters" className="w-full h-12 px-4 pr-11 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-sm placeholder:text-slate-400 bg-white" />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword((v) => !v)}
                      className="absolute right-0 top-0 h-12 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showSignupPassword}
                    >
                      <span className="material-symbols-outlined text-[20px]">{showSignupPassword ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>
                {turnstileSiteKey && (
                  <div className="flex justify-center my-4">
                    <Turnstile siteKey={turnstileSiteKey} />
                  </div>
                )}
                <button disabled={isLoading} type="submit" className="w-full h-12 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-[0.98] mt-4 flex items-center justify-center cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed">
                  {isLoading ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : 'Create Account'}
                </button>
              </form>
            )}

            <div className="mt-8 text-center">
              {activeTab === 'login' ? (
                <p className="text-sm text-slate-600">
                  Don&apos;t have an account? <button onClick={() => { setActiveTab('signup'); setError(null); setSuccessMessage(null); }} className="text-primary font-bold hover:underline cursor-pointer ml-1">Sign up for free</button>
                </p>
              ) : (
                <p className="text-sm text-slate-600">
                  Already have an account? <button onClick={() => { setActiveTab('login'); setError(null); setSuccessMessage(null); }} className="text-primary font-bold hover:underline cursor-pointer ml-1">Log in</button>
                </p>
              )}
            </div>

            {/* Bottom Trust Section */}
            <div className="mt-10 pt-6 border-t border-slate-100 flex flex-wrap justify-center gap-x-6 gap-y-3 text-slate-500 text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-blue-500">verified_user</span>
                Secure Authentication
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-500">login</span>
                Google Sign-In
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-purple-500">lock</span>
                Privacy First
              </div>
            </div>

          </div>
        </div>
      </section>
    </main>
  )
}
