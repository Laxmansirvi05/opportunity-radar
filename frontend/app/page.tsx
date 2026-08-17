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
        {/*
          min-w-0 and a size container, both because of the headline.

          A flex item defaults to min-width:auto, so it refuses to shrink below
          its min-content — and this column's min-content is the single word
          "opportunities?". At 1024px that pushed the column from its natural
          344px out to 403px, quietly stealing 59px from the globe beside it.
          min-w-0 lets the column hold the 45% it asks for.

          container-type then makes that width addressable, so the headline can
          be sized from the column it actually lives in rather than from the
          viewport — the two are not proportional here, because the row's
          padding is fixed while its width is not.
        */}
        <div className="w-full lg:w-[45%] min-w-0 [container-type:inline-size] flex flex-col items-start text-left mt-12 lg:mt-0 lg:ml-[8%]">
          <span className="rounded-full border border-slate-900/10 px-4 py-1.5 text-[13px] font-semibold tracking-wide text-slate-900/70 bg-white/40 backdrop-blur-md">
            AI-powered career platform
          </span>

          {/*
            No hard <br />. The two that used to be here forced "Too many
            places" onto its own line, which then soft-wrapped again because at
            5.2rem it did not fit the column — four lines measuring 379, 256,
            246 and 566px. The old max-w-2xl (672px) never applied either: this
            column is 45% of the row, about 566px on a laptop, so the column
            was always the narrower constraint.

            text-balance lets the browser even out the line lengths itself,
            which holds at every width instead of only the one the breaks were
            hand-tuned for.
          */}
          {/*
            Sized from the column, not from breakpoints or the viewport.

            "opportunities?" is a single unbreakable word and sets a hard
            ceiling: measured bold it is 6.73px wide per 1px of font-size, so it
            fits only while font-size stays under column/6.73 — that is 14.9%
            of the column. 14cqi takes that with a margin to spare, and because
            cqi resolves against the column, it stays true at every width
            instead of at the one it was tuned on. A fixed 4.75rem that cleared
            by 35px at 1512 overflowed by 21px at 1280; a vw-based formula hit
            zero clearance there too.

            Clamped so it never drops below 2.75rem on a phone or grows past
            5rem once the column is comfortably wider than the word.

            max-w caps the measure, not the size. Past ~1700px the column grows
            wider than the capped type needs, and the headline collapses to two
            long 700px lines — too wide to read comfortably, and not the three
            lines this is meant to be. 600px holds it at three while still
            clearing the 538px word. Below that the column is the narrower
            constraint, so this never binds.
          */}
          <h1
            style={{ fontSize: 'clamp(2.75rem, 14cqi, 5rem)' }}
            className="mt-7 w-full max-w-[600px] font-bold tracking-[-0.03em] text-slate-950 leading-[1.04] text-balance"
          >
            Too many places to find opportunities?
          </h1>

          {/* Two paragraphs, not one split by <br /><br />. A double break is
              a visual hack for a gap the browser will not size consistently;
              real paragraphs take a real gap. */}
          <div className="mt-7 flex max-w-lg flex-col gap-4 text-xl font-medium text-slate-800 leading-relaxed">
            <p>Your career opportunities shouldn&apos;t be scattered across hundreds of places.</p>
            <p>Opportunity Radar brings your career opportunities, AI tools and preparation into one intelligent platform.</p>
          </div>

          {/* The block below used a mix of mb- and mt- for its rhythm, so the
              gaps depended on which neighbour won. Spacing is now top-margin
              only, in one scale: 7 / 7 / 10 / 10. */}
          <div className="mt-10 flex flex-wrap items-center gap-6 sm:gap-8">
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

          <div className="mt-10 flex flex-wrap items-center gap-4">
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
