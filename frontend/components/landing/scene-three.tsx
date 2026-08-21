"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const features: {
  /** Footer deep-link target. Lives on the feature so reordering the list
   *  cannot silently point "Tracker" at the Notes card. */
  id: string;
  title: string;
  tagline: string;
  description: string;
  image: string;
  /**
   * How the shot sits in the 16/10 card.
   *
   * "cover" is right for anything at or narrower than the card — it fills
   * edge to edge and takes its crop from the bottom, where a screenshot
   * trailing off reads as "there is more below". "contain" is for a shot
   * WIDER than the card, where cover would crop the sides and cut content
   * mid-word; it letterboxes top and bottom instead.
   */
  fit?: "cover" | "contain";
  highlights: string[];
}[] = [
  {
    id: "feature-search",
    title: "Search",
    tagline: "Find opportunities without searching everywhere.",
    description:
      "Search across jobs, internships, hackathons, scholarships, competitions and more with freshness, category, location, mode and skill filters.",
    image: "/search.png",
    highlights: ["Fresh opportunities", "Powerful filters", "Multiple opportunity types"],
  },
  {
    id: "feature-ai-search",
    title: "AI Search",
    tagline: "Find the opportunities that fit you.",
    description:
      "AI analyzes the user's resume and identifies opportunities that best match their skills, experience and professional profile.",
    image: "/ai_search.png",
    highlights: ["Resume-aware matching", "Personalized results", "AI-ranked opportunities"],
  },
  {
    id: "feature-resume",
    title: "AI Resume Optimizer",
    tagline: "Turn your resume into the one they shortlist.",
    description:
      "Build or import a resume, score it against a real job description, and get gap-derived suggestions plus the certifications that close them.",
    image: "/resume_optimizer.png",
    highlights: ["Real ATS score", "Gap-derived suggestions", "Career insights"],
  },
  {
    id: "feature-tracker",
    title: "Application Tracker",
    tagline: "Know exactly where every application stands.",
    description:
      "Track opportunities from saved and applied through interviewing, offers and completed outcomes in one visual workflow.",
    image: "/application_tracker.png",
    highlights: ["Kanban workflow", "Application stages", "Deadline visibility"],
  },
  {
    id: "feature-notes",
    title: "Notes",
    tagline: "Keep every detail of your search in one place.",
    description:
      "Capture interview prep, company research and revision notes in colour-coded folders, with pinning, sharing, attachments and full-text search.",
    image: "/notes.png",
    highlights: ["Colour-coded folders", "Pin, share and archive", "Search across notes"],
  },
  {
    id: "feature-command-center",
    title: "Command Center",
    tagline: "Know what deserves your attention next.",
    description:
      "Bring career progress, saved opportunities, applications, interviews and urgent actions into one focused control center.",
    image: "/command_center.png",
    highlights: ["Priority actions", "Career overview", "Urgent alerts"],
  },
  {
    id: "feature-certifications",
    title: "Certifications",
    tagline: "Build the skills your opportunities demand.",
    description:
      "Discover relevant courses and certifications using filters for price, level, duration and provider.",
    image: "/certification.png",
    highlights: ["Skill discovery", "Provider filters", "Structured learning options"],
  },
  {
    id: "feature-ai-interview",
    title: "AI Interview",
    tagline: "Practice before the real interview.",
    description:
      "Simulate a live interview with an AI interviewer, respond in real time and build confidence before speaking with recruiters.",
    image: "/ai_interview.png",
    // 1.92 against the card's 1.60 — cover would slice 17% off the width and
    // cut the transcript text mid-sentence on both edges.
    fit: "contain",
    highlights: ["Live AI interviewer", "Real-time transcript", "Interview practice"],
  },
  {
    id: "feature-global-chat",
    title: "Global Chat",
    tagline: "You are not building your career alone.",
    description:
      "Connect with students, share opportunities, ask questions, exchange resources and learn together inside the global community.",
    image: "/global_chat.png",
    highlights: ["Global community", "Resource sharing", "Real-time discussion"],
  },
];

export default function SceneThree() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const leftTextsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rightTextsRef = useRef<(HTMLDivElement | null)[]>([]);
  const titlesRef = useRef<(HTMLDivElement | null)[]>([]);

  /** Hand-offs between cards — one fewer than the number of cards. */
  const segmentCount = features.length - 1;

  useGSAP(
    () => {
      // One segment per hand-off between cards, derived from the list rather
      // than hardcoded — this was `6` and `+=700%` for seven features, so
      // adding one silently left the last card unreachable.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: `+=${features.length * 100}%`,
          scrub: true,
        },
      });

      // Helper function for opacity based on depth
      const getOpacityForDepth = (d: number) => {
        if (d === 0) return 1;
        if (d === 1) return 0.95;
        if (d === 2) return 0.85;
        if (d === 3) return 0.72;
        if (d === 4) return 0.55;
        if (d === 5) return 0.35;
        return 0.1;
      };

      // Initial setup
      features.forEach((_, i) => {
        // Cards
        gsap.set(cardsRef.current[i], {
          scale: 1 - i * 0.04,
          y: i * 18,
          z: i * -25,
          rotateX: i * 2,
          opacity: getOpacityForDepth(i),
          zIndex: 20 - i,
          boxShadow: i === 0 
            ? "0 30px 80px -20px rgba(0,0,0,0.15), 0 0 0 1px rgba(203,213,225,0.8) inset" 
            : "0 10px 40px -10px rgba(0,0,0,0.05), 0 0 0 1px rgba(226,232,240,0.6) inset",
          borderColor: i === 0 ? "rgba(203,213,225,1)" : "rgba(226,232,240,0.8)",
        });

        // Left Text
        gsap.set(leftTextsRef.current[i], {
          opacity: i === 0 ? 1 : 0,
          y: i === 0 ? 0 : 30,
          pointerEvents: i === 0 ? "auto" : "none",
        });

        // Right Text
        gsap.set(rightTextsRef.current[i], {
          opacity: i === 0 ? 1 : 0,
          y: i === 0 ? 0 : 30,
          pointerEvents: i === 0 ? "auto" : "none",
        });

        // Titles
        gsap.set(titlesRef.current[i], {
          opacity: i === 0 ? 1 : 0,
          y: i === 0 ? 0 : 20,
        });
      });

      // Add animations for each segment
      for (let s = 0; s < segmentCount; s++) {
        features.forEach((_, i) => {
          const d = i - (s + 1); // distance of card i from active position
          
          let targetScale, targetY, targetZ, targetOpacity, targetRotateX, targetShadow, targetBorder;
          const absD = Math.abs(d);

          if (d === 0) {
            // Active
            targetScale = 1;
            targetY = 0;
            targetZ = 0;
            targetRotateX = 0;
            targetOpacity = 1;
            targetShadow = "0 30px 80px -20px rgba(0,0,0,0.15), 0 0 0 1px rgba(203,213,225,0.8) inset";
            targetBorder = "rgba(203,213,225,1)";
          } else {
            // Stack (Past cards go UP and back, Future cards go DOWN and back)
            targetScale = 1 - absD * 0.04;
            targetY = d * 18; 
            targetZ = absD * -25;
            targetRotateX = d * 2;
            targetOpacity = getOpacityForDepth(absD);
            targetShadow = "0 10px 40px -10px rgba(0,0,0,0.05), 0 0 0 1px rgba(226,232,240,0.6) inset";
            targetBorder = "rgba(226,232,240,0.8)";
          }

          // Animate card
          tl.to(
            cardsRef.current[i],
            {
              scale: targetScale,
              y: targetY,
              z: targetZ,
              opacity: targetOpacity,
              rotateX: targetRotateX,
              zIndex: 20 - absD,
              boxShadow: targetShadow,
              borderColor: targetBorder,
              duration: 1,
              ease: "power1.inOut",
            },
            s
          );

          // Determine target values for text
          const willBeActive = i === s + 1;
          const targetTextOpacity = willBeActive ? 1 : 0;
          const targetTextY = willBeActive ? 0 : i < s + 1 ? -30 : 30;

          // Left text
          tl.to(
            leftTextsRef.current[i],
            {
              opacity: targetTextOpacity,
              y: targetTextY,
              duration: 0.4,
              ease: "power2.inOut",
            },
            targetTextOpacity === 1 ? s + 0.6 : s
          );

          // Right text
          tl.to(
            rightTextsRef.current[i],
            {
              opacity: targetTextOpacity,
              y: targetTextY,
              duration: 0.4,
              ease: "power2.inOut",
            },
            targetTextOpacity === 1 ? s + 0.6 : s
          );

          // Titles
          tl.to(
            titlesRef.current[i],
            {
              opacity: targetTextOpacity,
              y: targetTextY,
              duration: 0.4,
              ease: "power2.inOut",
            },
            targetTextOpacity === 1 ? s + 0.6 : s
          );
        });
      }
    },
    { scope: containerRef }
  );

  return (
    <section
      ref={containerRef}
      className="relative w-full bg-transparent"
      style={{ height: `${(features.length + 1) * 100}vh` }}
    >
      {/* Navigation Anchors for Footer Links */}
      {features.map((f, i) => (
        <div
          key={f.id}
          id={f.id}
          className="absolute w-full h-px pointer-events-none"
          style={{ top: `${(i / segmentCount) * features.length * 100}vh` }}
        />
      ))}

      {/* Sticky Stage */}
      <div className="sticky top-0 w-full h-screen flex items-center justify-center overflow-hidden z-10 pointer-events-none">
        
        <div className="w-full max-w-[1920px] mx-auto px-4 lg:px-8 grid grid-cols-1 lg:grid-cols-[1fr_2.5fr_1fr] items-center gap-4 lg:gap-8 pointer-events-none">
          
          {/* Left Text */}
          <div className="relative h-[250px] lg:h-[500px] flex items-center justify-start lg:justify-end text-center lg:text-left pointer-events-auto z-20">
            {features.map((feature, i) => (
              <div
                key={`left-${i}`}
                ref={(el) => {
                  leftTextsRef.current[i] = el;
                }}
                className="absolute inset-x-0 lg:inset-x-auto lg:right-0 lg:max-w-[320px] xl:max-w-[380px] flex flex-col"
              >
                <h2 className="text-3xl lg:text-4xl xl:text-5xl font-extrabold text-slate-950 tracking-tight leading-[1.1] mb-6">
                  {feature.tagline}
                </h2>
                <p className="text-base lg:text-lg xl:text-xl text-slate-700 leading-relaxed font-medium">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          {/* Center 3D Stack */}
          <div className="relative w-full aspect-[16/10] max-h-[75vh] flex items-center justify-center pointer-events-auto z-10 flex-col">
            
            {/* Static Heading Above Stack */}
            <div className="absolute -top-16 lg:-top-24 left-0 lg:-left-[20%] xl:-left-[30%] w-full flex items-center justify-start pointer-events-none z-30">
              <h2 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold tracking-tight text-slate-950">
                Platform Capabilities
              </h2>
            </div>

            {/* Centered Dynamic Feature Titles (Moved Below Stack) */}
            <div className="absolute bottom-[-40px] lg:bottom-[-60px] w-full flex items-center justify-center pointer-events-none z-30">
              {features.map((feature, i) => (
                <div
                  key={`title-${i}`}
                  ref={(el) => {
                    titlesRef.current[i] = el;
                  }}
                  className="absolute flex items-center justify-center w-full"
                >
                  <h2 className="text-2xl sm:text-3xl lg:text-[40px] font-black tracking-tight text-slate-950 uppercase drop-shadow-sm whitespace-nowrap">
                    {feature.title}
                  </h2>
                </div>
              ))}
            </div>

            <div 
              className="relative w-full h-full flex items-center justify-center"
              style={{ perspective: "1500px", transformStyle: "preserve-3d" }}
            >
              {features.map((feature, i) => (
                <div
                  key={`card-${i}`}
                  ref={(el) => {
                    cardsRef.current[i] = el;
                  }}
                  className="absolute w-full h-full rounded-2xl bg-white/98 flex items-center justify-center overflow-hidden will-change-transform border border-transparent"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className={`w-full h-full bg-white ${
                      feature.fit === "contain" ? "object-contain" : "object-cover object-top"
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Right Text */}
          <div className="relative h-[200px] lg:h-[500px] flex items-center justify-center lg:justify-start pointer-events-auto z-20">
            {features.map((feature, i) => (
              <div
                key={`right-${i}`}
                ref={(el) => {
                  rightTextsRef.current[i] = el;
                }}
                className="absolute inset-x-0 lg:inset-x-auto lg:left-0 lg:max-w-[300px] xl:max-w-[360px] flex flex-col gap-4 text-center lg:text-left"
              >
                {feature.highlights.map((highlight, j) => (
                  <div key={j} className="flex items-center justify-center lg:justify-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] flex-shrink-0" />
                    <span className="text-base lg:text-lg xl:text-xl font-bold text-slate-800">{highlight}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
