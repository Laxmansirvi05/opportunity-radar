'use client'

import { useState } from 'react'
import { loginAction, signupAction, oauthLoginAction } from '@/features/auth/actions/auth-actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function AuthExperience() {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
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
        router.push('/dashboard')
      }
    } catch (e) {
      setError('An unexpected error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSignup(formData: FormData) {
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const result = await signupAction(formData)
      if (result?.error) {
        setError(result.error)
      } else if (result?.needsEmailConfirmation) {
        setSuccessMessage('Account created! Please check your email to verify your account.')
        setActiveTab('login')
        ;(document.getElementById('signup-form') as HTMLFormElement)?.reset()
      } else {
        router.push('/dashboard')
      }
    } catch (e) {
      setError('An unexpected error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col md:flex-row bg-background text-on-surface">
      {/* Left Section: Visual & Branding (Desktop only) */}
      <section className="hidden md:flex md:w-1/2 bg-surface-container-low relative flex-col justify-between p-xl overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #737686 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.05 }}></div>
        
        {/* Logo Anchor */}
        <div className="relative z-10">
          <div className="flex items-center gap-sm">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
            </div>
            <h1 className="font-headline-md text-headline-md font-bold text-primary tracking-tight">Opportunity Radar</h1>
          </div>
        </div>

        {/* Feature Highlight */}
        <div className="relative z-10 w-full max-w-[400px]">
          <h2 className="font-display text-display text-on-background mb-md whitespace-pre-line">
            {'Accelerate your\ncareer trajectory.'}
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[340px] leading-relaxed">
            The mission-control for students seeking world-class internships, fellowships, and early-career opportunities.
          </p>
          
          <div className="mt-xl space-y-md">
            <div className="flex items-center gap-md">
              <div className="flex -space-x-3">
                <img alt="User" className="w-8 h-8 rounded-full border-2 border-surface object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCca8KP1xzAYwtu1y_CRmPJiXLAU1LZiDryqeqeIrTEiFCMRfDwTpzjEUE7vZ6AHJRP_y3-FfmKfpXwB4Hr43gCcEM_XRh6OGeVXdgTDMSBCghn0PWBJPzU4FG9Evz-MeOJWbGaqXq16hjoKi1_5JstymKNCYfEBS5mlcO3ddfLdzvOX1YS36VIZ4mTCVww2X5L_Ij3Ytr4UMGP_93YAB_o8cAy1fDumsD1VZWvBnuDBcOXoJR6P9ldQ72hv1dSJw3oX6irp6WZvIuk" />
                <img alt="User" className="w-8 h-8 rounded-full border-2 border-surface object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDaSJ8UVgPR_-GPfjvbPFm1P2vPDz1X07FGm1hLZuzmX9qbGBMWQXYge4gGhFauobo7n32vyw3EynXfQiOTwSGYvHDeNvFM-GywblOiMXoUTUfDo7Ws4OcN9nIsGnVwr1-fdlCKyQzWLE0axNxBIA6bvLL3MdOfRmcEsvJNWAcuxAA3alkvwec3NLgCJv3AdDmq6WjQYbkXm9iuZ9OkcukJTxEuK7iQlC4Pc4r-H_Aj4qcNGOUxACfeTHT6NmokvM2fAE1EnJHbIY4r" />
                <img alt="User" className="w-8 h-8 rounded-full border-2 border-surface object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDgbkTyoHPkWZJOgxf9PS8zg_QeeI4LM3yPevHQIGyCDNc4_pXoMLlvLQtS95IlGFFQogQQiE2q8p_EhiosjbTET0yxeMkwDoaNvxz9Lx7KECd0yHR0_1DqUYy_Y7LPW5SkPkQWm-qWgpCOsgHokV2gtyt53TFnw1AS8sxi4Src9lUkGBiRdQ_pOmvAhha9FaGqL6DP6m30_tMMax6bnHF6nqGvCIPWAQ8q3ZFM93yAh4WEZXGs763m8b_hRTSU2IxbvAZlvGeT72Xe" />
              </div>
              <span className="font-label-md text-label-md text-on-surface-variant">Join 12,000+ ambitious students today</span>
            </div>
          </div>
        </div>

        {/* Footer Anchor */}
        <div className="relative z-10 flex flex-wrap gap-x-gutter gap-y-sm w-full max-w-[400px]">
          <span className="font-label-sm text-label-sm text-outline">© 2024 Opportunity Radar</span>
          <Link href="#" className="font-label-sm text-label-sm text-outline hover:text-primary transition-colors">Privacy Policy</Link>
          <Link href="#" className="font-label-sm text-label-sm text-outline hover:text-primary transition-colors">Documentation</Link>
        </div>
        
        {/* Abstract Graphic Element */}
        <div className="absolute -right-24 bottom-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      </section>

      {/* Right Section: Authentication Forms */}
      <section className="flex-1 flex flex-col justify-center items-center px-margin-mobile md:px-gutter bg-surface relative">
        {/* Mobile Logo */}
        <div className="md:hidden absolute top-md left-margin-mobile flex items-center gap-sm">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
          </div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-primary tracking-tight">Opportunity Radar</h1>
        </div>

        <div className="w-full max-w-[400px] py-xl flex flex-col">
          {/* Toggle Header */}
          <div className="flex mb-xl border-b border-outline-variant">
            <button 
              onClick={() => { setActiveTab('login'); setError(null); setSuccessMessage(null); }}
              className={`flex-1 pb-md font-label-md text-label-md transition-all duration-300 border-b-2 cursor-pointer ${activeTab === 'login' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
            >
              Log In
            </button>
            <button 
              onClick={() => { setActiveTab('signup'); setError(null); setSuccessMessage(null); }}
              className={`flex-1 pb-md font-label-md text-label-md transition-all duration-300 border-b-2 cursor-pointer ${activeTab === 'signup' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-md p-sm bg-error-container text-on-error-container rounded-lg font-label-md text-center">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-md p-sm bg-secondary-container text-on-secondary-container rounded-lg font-label-md text-center">
              {successMessage}
            </div>
          )}

          {/* Social Auth Container */}
          <div className="space-y-sm mb-lg">
            <button 
              onClick={() => oauthLoginAction('google', '/dashboard')}
              className="w-full flex items-center justify-center gap-md py-md px-md bg-surface-container-lowest border border-outline-variant rounded-xl font-label-md text-label-md text-on-surface hover:bg-surface-container transition-all active:scale-[0.98] cursor-pointer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Google" className="w-5 h-5" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6F2Dv8z4_KK4M2O9494JxG-fgBJslz2N2xzWIbuBNrgmgFCxpvRORaYu_0AjHXOqrFJ2HQKlanV892tZiMH9fWsz8WO-ejY0rTGJaO-iMqDDukvSHZLQcQz4sXAk34Ptnc37KYlQxD9AltrqWkTSL_bHsrYne3F5XBKKeccQfS4EOcA6URqRxsYJpDkuQPspodVRbunOZgwDsBI3rBqnYlIsRvMRnumGS3aMd3KJJIxrHSzXt6STUFuFSUeFmI3MVFfEJClzItEWm" />
              Continue with Google
            </button>
            <button 
              onClick={() => oauthLoginAction('github', '/dashboard')}
              className="w-full flex items-center justify-center gap-md py-md px-md bg-surface-container-lowest border border-outline-variant rounded-xl font-label-md text-label-md text-on-surface hover:bg-surface-container transition-all active:scale-[0.98] cursor-pointer"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"></path></svg>
              Continue with GitHub
            </button>
          </div>

          <div className="relative flex items-center justify-center mb-lg">
            <div className="flex-grow border-t border-outline-variant"></div>
            <span className="mx-md font-label-sm text-label-sm text-outline bg-surface px-sm uppercase tracking-widest">or</span>
            <div className="flex-grow border-t border-outline-variant"></div>
          </div>

          {/* Login Form */}
          {activeTab === 'login' && (
            <form action={handleLogin} className="space-y-md flex flex-col">
              <div className="space-y-xs flex flex-col">
                <label className="font-label-md text-label-md text-on-surface-variant px-xs" htmlFor="email">Email Address</label>
                <input required name="email" id="email" type="email" placeholder="name@university.edu" className="w-full h-12 px-md border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-body-md text-body-md" />
              </div>
              <div className="space-y-xs flex flex-col">
                <div className="flex justify-between items-center px-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="password">Password</label>
                  <Link href="/forgot-password" className="font-label-sm text-label-sm text-primary hover:underline">Forgot Password?</Link>
                </div>
                <input required name="password" id="password" type="password" placeholder="••••••••" className="w-full h-12 px-md border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-body-md text-body-md" />
              </div>
              <button disabled={isLoading} type="submit" className="w-full h-12 bg-primary text-on-primary font-label-md text-label-md rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98] mt-lg flex items-center justify-center cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed">
                {isLoading ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : 'Sign In'}
              </button>
            </form>
          )}

          {/* Signup Form */}
          {activeTab === 'signup' && (
            <form id="signup-form" action={handleSignup} className="space-y-md flex flex-col">
              <div className="space-y-xs flex flex-col">
                <label className="font-label-md text-label-md text-on-surface-variant px-xs" htmlFor="name">Full Name</label>
                <input required name="name" id="name" type="text" placeholder="Alex Student" className="w-full h-12 px-md border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-body-md text-body-md" />
              </div>
              <div className="space-y-xs flex flex-col">
                <label className="font-label-md text-label-md text-on-surface-variant px-xs" htmlFor="email">University Email</label>
                <input required name="email" id="email" type="email" placeholder="alex@university.edu" className="w-full h-12 px-md border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-body-md text-body-md" />
              </div>
              <div className="space-y-xs flex flex-col">
                <label className="font-label-md text-label-md text-on-surface-variant px-xs" htmlFor="password">Create Password</label>
                <input required minLength={6} name="password" id="password" type="password" placeholder="At least 6 characters" className="w-full h-12 px-md border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-body-md text-body-md" />
              </div>
              <p className="font-label-sm text-label-sm text-outline px-xs leading-relaxed">
                By signing up, you agree to our <Link href="#" className="text-on-surface underline">Terms</Link> and <Link href="#" className="text-on-surface underline">Privacy Policy</Link>.
              </p>
              <button disabled={isLoading} type="submit" className="w-full h-12 bg-primary text-on-primary font-label-md text-label-md rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98] mt-lg flex items-center justify-center cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed">
                {isLoading ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : 'Create Account'}
              </button>
            </form>
          )}

          <div className="mt-xl text-center">
            {activeTab === 'login' ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                Don&apos;t have an account? <button onClick={() => { setActiveTab('signup'); setError(null); setSuccessMessage(null); }} className="text-primary font-semibold hover:underline cursor-pointer">Sign up for free</button>
              </p>
            ) : (
              <p className="font-body-md text-body-md text-on-surface-variant">
                Already have an account? <button onClick={() => { setActiveTab('login'); setError(null); setSuccessMessage(null); }} className="text-primary font-semibold hover:underline cursor-pointer">Log in</button>
              </p>
            )}
          </div>
        </div>

        <Link href="/" className="absolute bottom-xl flex items-center gap-xs font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Return to Home
        </Link>
      </section>
    </main>
  )
}
