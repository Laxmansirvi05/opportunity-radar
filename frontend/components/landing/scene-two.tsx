"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "framer-motion";

// ─── Data ─────────────────────────────────────────────────────────────────────

const OPPORTUNITIES = [
  // Upper-left
  { label: "Jobs",            x: -300, y: -100, z:  40, rx:  5, ry: -8,  start: 0.05, end: 0.25, rStart: 0.82, rEnd: 0.94 },
  // Upper-center
  { label: "Internships",     x:    0, y: -120, z:  60, rx:  8, ry:  0,  start: 0.07, end: 0.27, rStart: 0.83, rEnd: 0.95 },
  // Upper-right
  { label: "Competitions",    x:  300, y: -100, z:  30, rx:  6, ry: 10,  start: 0.09, end: 0.29, rStart: 0.84, rEnd: 0.96 },
  // Left
  { label: "Hackathons",      x: -380, y:   20, z: -20, rx: -2, ry:-12,  start: 0.06, end: 0.26, rStart: 0.825, rEnd: 0.945 },
  // Right
  { label: "Scholarships",    x:  380, y:   10, z: -30, rx: -4, ry: 14,  start: 0.08, end: 0.28, rStart: 0.835, rEnd: 0.955 },
  // Lower-left
  { label: "Company Careers", x: -280, y:  110, z:  20, rx:  4, ry:-10,  start: 0.10, end: 0.30, rStart: 0.845, rEnd: 0.965 },
  // Center-right
  { label: "Workshops",       x:  180, y:   60, z:  50, rx:  4, ry:  6,  start: 0.11, end: 0.31, rStart: 0.85, rEnd: 0.97 },
  // Lower-right
  { label: "College Groups",  x:  320, y:  100, z: -20, rx: -3, ry: 12,  start: 0.12, end: 0.32, rStart: 0.855, rEnd: 0.975 },
];

const ACTIONS = [
  // Discover -> far lower-left
  { label: "Discover", x: -340, y: 190, z:  20, rx:  3, ry: -5, start: 0.40, end: 0.55, rStart: 0.82, rEnd: 0.92 },
  // Decide -> lower-left-center
  { label: "Decide",   x: -140, y: 220, z: -15, rx: -2, ry: -3, start: 0.42, end: 0.57, rStart: 0.83, rEnd: 0.93 },
  // Track -> lower-right-center
  { label: "Track",    x:  140, y: 220, z:  20, rx:  2, ry:  3, start: 0.44, end: 0.59, rStart: 0.84, rEnd: 0.94 },
  // Prepare -> far lower-right
  { label: "Prepare",  x:  340, y: 190, z: -15, rx: -3, ry:  5, start: 0.46, end: 0.61, rStart: 0.85, rEnd: 0.95 },
];

// ─── 3D Opportunity Card ──────────────────────────────────────────────────────

function Card3D({
  children,
  className,
  progress,
  targetX,
  targetY,
  targetZ,
  targetRX,
  targetRY,
  startP,
  endP,
  rStart,
  rEnd,
}: {
  children: React.ReactNode;
  className?: string;
  progress: MotionValue<number>;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetRX: number;
  targetRY: number;
  startP: number;
  endP: number;
  rStart: number;
  rEnd: number;
}) {
  const mid = startP + (endP - startP) * 0.5;
  const fadeIn = startP + (endP - startP) * 0.3;

  const x = useTransform(progress, [startP, mid, endP], [0, targetX * 0.4, targetX]);
  const y = useTransform(progress, [startP, mid, endP], [0, targetY * 0.3, targetY]);
  const z = useTransform(progress, [startP, endP], [0, targetZ]);
  const rotateX = useTransform(progress, [startP, endP], [0, targetRX]);
  const rotateY = useTransform(progress, [startP, endP], [0, targetRY]);
  const scale = useTransform(progress, [startP, fadeIn, endP], [0.3, 0.9, 1]);
  const opacity = useTransform(progress, [startP, fadeIn], [0, 1]);

  return (
    <motion.div
      style={{
        x, y, z, scale, opacity,
        rotateX, rotateY,
      }}
      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10
        flex items-center gap-2.5 rounded-2xl whitespace-nowrap
        border border-white/80 bg-white/98
        px-5 py-3 text-[15px] font-semibold text-slate-950
        shadow-[0_12px_40px_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,0.8)_inset]
        will-change-transform ${className ?? ""}`}
    >
      <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.9)]" />
      {children}
    </motion.div>
  );
}

// ─── Energy Trail (CSS gradient beam) ─────────────────────────────────────────

function EnergyTrail({
  targetX,
  targetY,
  progress,
  startP,
  endP,
  rStart,
  rEnd,
}: {
  targetX: number;
  targetY: number;
  progress: MotionValue<number>;
  startP: number;
  endP: number;
  rStart: number;
  rEnd: number;
}) {
  const angle = Math.atan2(targetY, targetX) * (180 / Math.PI);
  const length = Math.sqrt(targetX * targetX + targetY * targetY);

  const fadeIn = startP + (endP - startP) * 0.1;

  const scaleX = useTransform(progress, [startP, endP], [0, 1]);
  const opacity = useTransform(progress, [startP, fadeIn], [0, 0.65]);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: `${Math.round(length)}px`,
        height: "2px",
        transformOrigin: "left center",
        transform: `translateY(-50%) rotate(${angle.toFixed(2)}deg)`,
        pointerEvents: "none",
      }}
    >
      <motion.div
        style={{ scaleX, opacity }}
        className="h-full w-full origin-left will-change-transform"
      >
        <div className="h-full w-full bg-blue-400/80 rounded-full" />
      </motion.div>
    </div>
  );
}

// ─── Trail Particle (small dot traveling along trail) ─────────────────────────

function TrailDot({
  targetX,
  targetY,
  progress,
  startP,
  endP,
  rStart,
  rEnd,
  delay,
}: {
  targetX: number;
  targetY: number;
  progress: MotionValue<number>;
  startP: number;
  endP: number;
  rStart: number;
  rEnd: number;
  delay: number;
}) {
  const duration = endP - startP;
  const dStart = startP + delay * duration;
  const dEnd = endP + delay * duration * 0.3;

  // Clamp to [0,1]
  const s = Math.min(Math.max(dStart, 0), 0.99);
  const e = Math.min(Math.max(dEnd, s + 0.01), 1.0);
  const mid = s + (e - s) * 0.5;

  const x = useTransform(progress, [s, mid, e], [0, targetX * 0.5, targetX]);
  const y = useTransform(progress, [s, mid, e], [0, targetY * 0.5, targetY]);
  
  const fadeEnd = s + (e - s) * 0.15;
  const fadeOutStart = s + (e - s) * 0.75;
  const dotOpacity = useTransform(progress, [s, fadeEnd, fadeOutStart, e], [0, 1, 1, 0]);

  return (
    <motion.div
      style={{ x, y, opacity: dotOpacity }}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.8)] pointer-events-none will-change-transform"
    />
  );
}

// ─── 3D Radar Hub ─────────────────────────────────────────────────────────────

function RadarHub({ progress }: { progress: MotionValue<number> }) {
  const hubScale = useTransform(progress, [0, 0.08, 0.14], [0.4, 1.05, 1]);
  const hubOpacity = useTransform(progress, [0, 0.06], [0, 1]);
  const glowIntensity = useTransform(progress, [0.04, 0.12], [0, 1]);

  const lightTransition = useTransform(progress, [0, 1], [0, 0]); // Never transition to light state while active

  // Pulse rings
  const pulse1Scale = useTransform(progress, [0.06, 0.14, 0.22, 0.30, 0.50], [1, 1.6, 1, 1.6, 1]);
  const pulse1Opacity = useTransform(progress, [0.06, 0.14, 0.22, 0.30, 0.50], [0.7, 0, 0.7, 0, 0]);
  const pulse2Scale = useTransform(progress, [0.10, 0.18, 0.26, 0.34, 0.55], [1, 1.8, 1, 1.8, 1]);
  const pulse2Opacity = useTransform(progress, [0.10, 0.18, 0.26, 0.34, 0.55], [0.4, 0, 0.4, 0, 0]);

  // Orbital particles
  const orbit1 = useTransform(progress, [0.05, 0.95], [0, 720]);
  const orbit2 = useTransform(progress, [0.05, 0.95], [120, 840]);
  const orbit3 = useTransform(progress, [0.05, 0.95], [240, 960]);
  const orbitOpacity = useTransform(progress, [0.06, 0.12], [0, 1]);

  return (
    <motion.div
      style={{ scale: hubScale, opacity: hubOpacity }}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 will-change-transform"
    >
      {/* Ambient glow - optimized using radial-gradient instead of heavy blur */}
      <motion.div
        style={{
          opacity: glowIntensity,
          background: "radial-gradient(circle, rgba(59,130,246,0.3) 0%, rgba(59,130,246,0.08) 50%, rgba(59,130,246,0) 75%)"
        }}
        className="absolute -inset-28 rounded-full pointer-events-none will-change-transform"
      />

      {/* Outer tilted ring 1 */}
      <div
        className="absolute -inset-10 rounded-full border-[1.5px] border-blue-300/50"
        style={{ transform: "rotateX(65deg)" }}
      />
      {/* Outer tilted ring 2 */}
      <div
        className="absolute -inset-14 rounded-full border border-blue-200/35"
        style={{ transform: "rotateX(65deg) rotateZ(30deg)" }}
      />
      {/* Outer tilted ring 3 */}
      <div
        className="absolute -inset-[4.5rem] rounded-full border border-blue-200/25"
        style={{ transform: "rotateX(60deg) rotateZ(-20deg)" }}
      />

      {/* Pulse ring 1 */}
      <motion.div
        style={{ scale: pulse1Scale, opacity: pulse1Opacity }}
        className="absolute -inset-1 rounded-full border-[2.5px] border-blue-400/90 pointer-events-none will-change-transform"
      />
      {/* Pulse ring 2 */}
      <motion.div
        style={{ scale: pulse2Scale, opacity: pulse2Opacity }}
        className="absolute -inset-1 rounded-full border-2 border-blue-300/80 pointer-events-none will-change-transform"
      />

      {/* Orbital particles */}
      {[
        { rotate: orbit1, radius: 56, size: "w-1.5 h-1.5" },
        { rotate: orbit2, radius: 72, size: "w-1 h-1" },
        { rotate: orbit3, radius: 48, size: "w-1 h-1" },
      ].map((orb, i) => (
        <motion.div
          key={i}
          style={{
            rotate: orb.rotate,
            opacity: orbitOpacity,
          }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none will-change-transform"
        >
          <div
            className={`${orb.size} rounded-full bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.8)]`}
            style={{ transform: `translateX(${orb.radius}px)` }}
          />
        </motion.div>
      ))}

      {/* Main hub body */}
      <div className="relative h-36 w-36 rounded-full bg-gradient-to-br from-blue-100 via-blue-200 to-blue-300 border-[3px] border-blue-400/80 shadow-[0_0_50px_rgba(59,130,246,0.40),0_0_20px_rgba(59,130,246,0.20),0_4px_24px_rgba(0,0,0,0.15)] flex items-center justify-center">
        {/* Inner ring */}
        <div className="absolute inset-2.5 rounded-full border-2 border-blue-400/50" />
        {/* Inner ring 2 */}
        <div className="absolute inset-5 rounded-full border-[1.5px] border-blue-400/35" />

        {/* Blue core (Dark) */}
        <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-blue-600 to-indigo-800 shadow-[0_0_30px_rgba(59,130,246,0.9),0_0_60px_rgba(59,130,246,0.4)] flex items-center justify-center text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="z-10 drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]"
          >
            <circle cx="12" cy="12" r="2" />
            <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
            <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
          </svg>
          
          {/* Light overlay for transition to Scene 3 */}
          <motion.div 
            style={{ opacity: lightTransition }}
            className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-100 to-white shadow-[0_0_40px_rgba(59,130,246,0.6)] flex items-center justify-center text-blue-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="2" />
              <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
              <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
            </svg>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Scene Two ────────────────────────────────────────────────────────────────

export default function SceneTwo() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Strict conceptual state:
  // BUILD: 0.0 -> 0.7
  // HOLD: 0.7 -> 1.0
  // By clamping progress here, we guarantee NO reverse animations, NO fade outs, 
  // and NO disappearances can possibly occur while scrolling down.
  const buildProgress = useTransform(scrollYProgress, [0, 0.7, 1], [0, 0.7, 0.7]);

  return (
    <div ref={containerRef} className="relative h-[250vh] w-full">
      <motion.div
        className="sticky top-0 h-screen w-full flex flex-col items-center justify-center pointer-events-none"
      >
        {/* ── Top Text ── */}
        <div className="absolute top-24 lg:top-32 flex flex-col items-center text-center px-6 w-full max-w-3xl pointer-events-auto z-30">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-950 mb-6">
            Your opportunities are everywhere.<br />
            That&apos;s the problem.
          </h2>
          <p className="text-lg sm:text-xl font-medium text-slate-700 leading-relaxed max-w-2xl">
            Jobs, internships, hackathons, competitions, scholarships and more
            are scattered across different platforms and communities.
          </p>
        </div>

        {/* ── 3D Animation Canvas ── */}
        {/* The headline above is position:absolute, so it doesn't reserve
            space in normal flow for this canvas's mt-* margin to clear —
            on mobile the paragraph wraps to more lines than desktop and
            the "Internships" card (targetY -120) overlapped the text.
            Extra top margin on the smallest breakpoint gives it clearance;
            lg keeps the original spacing since desktop never overlapped. */}
        <div
          className="relative w-full h-[340px] sm:h-[380px] lg:h-[460px] flex items-center justify-center pointer-events-auto mt-44 sm:mt-28 lg:mt-32 scale-75 sm:scale-90 lg:scale-100"
          style={{ perspective: "1200px", transformStyle: "preserve-3d" }}
        >
          {/* Energy Trails - OPPORTUNITIES ONLY */}
          {OPPORTUNITIES.map((opp, i) => (
            <EnergyTrail
              key={`trail-opp-${i}`}
              targetX={opp.x}
              targetY={opp.y}
              progress={buildProgress}
              startP={opp.start}
              endP={opp.end}
              rStart={opp.rStart}
              rEnd={opp.rEnd}
            />
          ))}

          {/* Trail Particles - OPPORTUNITIES ONLY */}
          {OPPORTUNITIES.map((opp, i) => (
            <div key={`dots-opp-${i}`}>
              <TrailDot targetX={opp.x} targetY={opp.y} progress={buildProgress} startP={opp.start} endP={opp.end} rStart={opp.rStart} rEnd={opp.rEnd} delay={0} />
              <TrailDot targetX={opp.x} targetY={opp.y} progress={buildProgress} startP={opp.start} endP={opp.end} rStart={opp.rStart} rEnd={opp.rEnd} delay={0.15} />
            </div>
          ))}

          {/* Opportunity Cards */}
          {OPPORTUNITIES.map((opp, i) => (
            <Card3D
              key={`card-opp-${i}`}
              progress={buildProgress}
              targetX={opp.x}
              targetY={opp.y}
              targetZ={opp.z}
              targetRX={opp.rx}
              targetRY={opp.ry}
              startP={opp.start}
              endP={opp.end}
              rStart={opp.rStart}
              rEnd={opp.rEnd}
            >
              {opp.label}
            </Card3D>
          ))}

          {/* Action Cards */}
          {ACTIONS.map((act, i) => (
            <Card3D
              key={`card-act-${i}`}
              progress={buildProgress}
              targetX={act.x}
              targetY={act.y}
              targetZ={act.z}
              targetRX={act.rx}
              targetRY={act.ry}
              startP={act.start}
              endP={act.end}
              rStart={act.rStart}
              rEnd={act.rEnd}
              className="!bg-slate-950/90 !text-white !border-slate-700/60 !shadow-[0_8px_32px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.1)_inset]"
            >
              {act.label}
            </Card3D>
          ))}

          {/* 3D Radar Hub */}
          <RadarHub progress={buildProgress} />
        </div>

        {/* ── Bottom Text ── */}
        <div className="absolute bottom-12 lg:bottom-20 flex flex-col items-center px-6 w-full pointer-events-auto z-30">
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-950">
            What if everything was in one place?
          </h3>
        </div>
      </motion.div>
    </div>
  );
}
