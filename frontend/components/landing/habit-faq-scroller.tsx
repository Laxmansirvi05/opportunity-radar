"use client";

import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";

// --- FAQ Data ---

const ROW_1 = [
  {
    q: "What is Opportunity Radar?",
    a: "Opportunity Radar is a career opportunity platform that brings jobs, internships, hackathons, competitions, scholarships, workshops and other student-focused opportunities into one place.",
  },
  {
    q: "How does Opportunity Radar find opportunities?",
    a: "The platform collects opportunities from supported sources and organizes them into a searchable experience so students can discover relevant opportunities without checking many platforms separately.",
  },
  {
    q: "Can I search opportunities using filters?",
    a: "Yes. You can refine opportunities using available filters such as category, freshness, location, mode, compensation, skills and other supported criteria.",
  },
  {
    q: "Are the opportunities updated regularly?",
    a: "Opportunity Radar is designed to refresh opportunity data regularly so new opportunities can be discovered and expired opportunities can be handled appropriately.",
  },
];

const ROW_2 = [
  {
    q: "Is my personal data secure?",
    a: "Opportunity Radar is designed to protect user information using standard application security practices. Access to personal account data should be limited to authorized users and services.",
  },
  {
    q: "Will my resume or personal data be shared with other users?",
    a: "Your personal resume and account information should not be publicly exposed to other users. Data is used within the platform for the features you enable, such as personalized opportunity matching.",
  },
  {
    q: "How does AI Search use my resume?",
    a: "AI Search analyzes relevant information from your resume to identify opportunities that better match your skills, experience and profile. The purpose is to improve relevance, not to publicly publish your resume.",
  },
  {
    q: "Does AI make the final decision for me?",
    a: "No. AI Search provides recommendations and relevance signals to help you discover opportunities. You remain responsible for reviewing the opportunity details and deciding whether to apply.",
  },
];

const ROW_3 = [
  {
    q: "Can I track my applications?",
    a: "Yes. Application Tracker lets you organize opportunities across stages such as Saved, Applied, Interviewing, Offer and Rejected so you can keep track of your progress.",
  },
  {
    q: "Can I discover certifications and courses here?",
    a: "Yes. The Certifications section helps you discover courses and certifications using filters such as price, level, duration and provider.",
  },
  {
    q: "Can I practice interviews with AI?",
    a: "Yes. AI Interview provides a simulated interview experience that helps you practice responses, interact with an AI interviewer and review the interview conversation.",
  },
  {
    q: "Can I connect with other students?",
    a: "Yes. Global Chat provides a community space where students can discuss opportunities, ask questions, share resources and learn from one another.",
  },
];

// --- Components ---

function FaqCard({ q, a }: { q: string; a: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      className="flex-shrink-0 w-[300px] sm:w-[380px] md:w-[460px] bg-white/90 backdrop-blur-md rounded-2xl p-6 md:p-8 
                 border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.04)] 
                 hover:shadow-[0_12px_40px_rgba(59,130,246,0.12)] hover:border-blue-200 transition-all duration-300
                 flex flex-col gap-4 whitespace-normal"
    >
      <h3 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">
        {q}
      </h3>
      <p className="text-base md:text-[17px] text-slate-600 leading-relaxed font-medium">
        {a}
      </p>
    </motion.div>
  );
}

function HorizontalScroller({
  items,
  direction,
  speed,
}: {
  items: { q: string; a: string }[];
  direction: "left" | "right";
  speed: number;
}) {
  // Duplicate items 4 times to ensure it's wide enough for continuous scrolling on large screens
  const duplicatedItems = [...items, ...items, ...items, ...items];
  
  // We want to translate from 0 to -50% (if duplicated 4 times, -50% covers 2 sets, meaning it loops perfectly back to start)
  const xValues = direction === "left" ? ["0%", "-50%"] : ["-50%", "0%"];

  return (
    <div className="relative flex w-full overflow-hidden py-4 -my-4 mask-edges">
      {/* 
        mask-edges could be applied via Tailwind, but we will use CSS mask-image 
        in a local style block or just rely on the container.
      */}
      <div 
        className="absolute inset-y-0 left-0 w-[5%] md:w-[10%] bg-gradient-to-r from-slate-50/50 to-transparent z-10 pointer-events-none" 
        style={{ backdropFilter: "blur(0px)" }} // just a subtle fade
      />
      <div 
        className="absolute inset-y-0 right-0 w-[5%] md:w-[10%] bg-gradient-to-l from-slate-50/50 to-transparent z-10 pointer-events-none" 
      />
      
      <motion.div
        className="flex gap-6 md:gap-8 px-3 md:px-4"
        animate={{ x: xValues }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration: speed,
        }}
      >
        {duplicatedItems.map((item, idx) => (
          <FaqCard key={`${item.q}-${idx}`} q={item.q} a={item.a} />
        ))}
      </motion.div>
    </div>
  );
}

export default function FaqSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="faq" ref={ref} className="relative w-full py-32 lg:py-48 overflow-hidden z-20">
      <div className="container mx-auto px-6 mb-16 md:mb-24 flex flex-col items-center text-center">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-950 mb-6"
        >
          Frequently Asked Questions
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="text-lg md:text-xl text-slate-700 max-w-3xl leading-relaxed font-medium"
        >
          Everything you need to know about Opportunity Radar, how it works, how your data is handled, and how the platform helps you discover better opportunities.
        </motion.p>
      </div>

      <div className="flex flex-col gap-8 md:gap-10">
        <HorizontalScroller items={ROW_1} direction="left" speed={60} />
        <HorizontalScroller items={ROW_2} direction="right" speed={45} />
        <HorizontalScroller items={ROW_3} direction="left" speed={70} />
      </div>
    </section>
  );
}
