import Link from 'next/link'
import KineticGrid from '@/components/landing/kinetic-grid'
import { Component as InteractiveGlobe } from '@/components/landing/interactive-globe'
import SceneTwo from '@/components/landing/scene-two'
import SceneThree from '@/components/landing/scene-three'
import FaqSection from '@/components/landing/habit-faq-scroller'
import HoverFooter from '@/components/landing/hover-footer'

export default function HomePage() {
  return (
    <KineticGrid>
      {/* Navigation */}
      <nav className="absolute top-0 w-full flex items-center justify-between px-6 py-6 z-20">
        <div className="font-semibold text-slate-950 text-[22px] tracking-tight">
          Opportunity Radar
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-[15px] font-medium text-slate-700 hover:text-slate-950 transition-colors">
            Login
          </Link>
          <Link href="/signup" className="rounded-full bg-slate-950 px-5 py-2.5 text-[15px] font-medium text-white hover:bg-slate-800 transition-colors">
            Sign up
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex min-h-screen flex-col lg:flex-row items-center justify-between px-6 lg:px-24 pt-24 pb-12 z-10 relative">

        {/* Left Side: Text Content */}
        <div className="w-full lg:w-[45%] flex flex-col items-start text-left mt-12 lg:mt-0 lg:ml-[8%]">
          <span className="mb-6 rounded-full border border-slate-900/10 px-4 py-1.5 text-[13px] font-semibold tracking-wide text-slate-900/70 bg-white/40 backdrop-blur-md">
            AI-powered career platform
          </span>

          <h1 className="max-w-2xl text-[3.5rem] font-bold tracking-tight text-slate-950 sm:text-[4.25rem] lg:text-[5.2rem] leading-[1.05] mb-6">
            Too many places<br />
            to find<br />
            opportunities?
          </h1>

          <p className="mt-2 max-w-lg text-xl font-medium text-slate-800 mb-10 leading-relaxed">
            Your career opportunities shouldn&apos;t be scattered across hundreds of places.
            <br /><br />
            Opportunity Radar brings your career opportunities, AI tools and preparation into one intelligent platform.
          </p>

          <div className="flex flex-wrap items-center gap-6 sm:gap-8 mb-10">
            <div className="flex flex-col">
              <span className="text-4xl font-extrabold text-slate-950">4,700+</span>
              <span className="text-sm font-medium text-slate-500 mt-1">Opportunities</span>
            </div>
            <div className="hidden sm:block h-12 w-px bg-slate-900/10"></div>
            <div className="flex flex-col">
              <span className="text-4xl font-extrabold text-slate-950">1,700+</span>
              <span className="text-sm font-medium text-slate-500 mt-1">Companies</span>
            </div>
            <div className="hidden sm:block h-12 w-px bg-slate-900/10"></div>
            <div className="flex flex-col">
              <span className="text-4xl font-extrabold text-slate-950">Daily</span>
              <span className="text-sm font-medium text-slate-500 mt-1">New opportunities</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="rounded-full bg-slate-950 px-8 py-3.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-sm"
            >
              Explore Opportunity Radar
            </Link>
            <a
              href="#feature-search"
              className="rounded-full border border-slate-900/10 bg-white/50 backdrop-blur-sm px-8 py-3.5 text-sm font-semibold text-slate-900 hover:bg-white/80 transition-colors shadow-sm"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Right Side: Globe */}
        <div className="w-full lg:w-[55%] flex items-center justify-center h-[540px] lg:h-[810px] relative mt-12 lg:mt-0">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at center, rgba(255,255,255,0.9) 20%, rgba(255,255,255,0) 65%)' }} />
          <InteractiveGlobe size={765} className="max-w-full z-10" />
        </div>
      </div>

      {/* Scene 2 Scroll Animation */}
      <SceneTwo />

      {/* Scene 3 Scroll Animation */}
      <SceneThree />

      {/* Scene 4 FAQ Scroller */}
      <FaqSection />

      {/* Scene 5 Footer */}
      <HoverFooter />
    </KineticGrid>
  )
}
