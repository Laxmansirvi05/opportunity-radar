"use client";

import React from "react";
import { Mail, MessageCircle, MapPin } from "lucide-react";
import Link from "next/link";

export default function HoverFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative w-full bg-[#07080A] text-slate-300 pt-16 pb-4 overflow-hidden z-20 border-t border-slate-900/50">
      <div className="container mx-auto px-6 max-w-[1400px] relative z-10">
        
        {/* Top 4-Column Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 mb-16">
          
          {/* Column 1: Brand */}
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold text-white tracking-tight">Opportunity Radar</h3>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              A unified platform for discovering opportunities, managing applications, building skills, preparing for interviews, and connecting with the community.
            </p>
          </div>

          {/* Column 2: Product */}
          <div className="flex flex-col gap-4 lg:pl-4">
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Product</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                { name: "Search", href: "#feature-search" },
                { name: "Certifications", href: "#feature-certifications" },
                { name: "AI Search", href: "#feature-ai-search" },
                { name: "AI Interview", href: "#feature-ai-interview" },
                { name: "Tracker", href: "#feature-tracker" },
                { name: "Global Chat", href: "#feature-global-chat" },
                { name: "Command Ctr", href: "#feature-command-center" },
              ].map((link) => (
                <Link key={link.name} href={link.href} className="text-sm text-slate-400 hover:text-blue-500 transition-colors duration-200">
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Column 3: Resources */}
          <div className="flex flex-col gap-4 lg:pl-8">
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Resources</h4>
            <ul className="flex flex-col gap-3">
              {[
                { name: "FAQ", href: "#faq" },
                { name: "Support", href: "/support" },
                { name: "Community", href: "#feature-global-chat" },
                { name: "Privacy Policy", href: "/privacy" },
                { name: "Terms & Conditions", href: "/terms" },
              ].map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm text-slate-400 hover:text-blue-500 transition-colors duration-200">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact */}
          <div className="flex flex-col gap-4 lg:pl-8">
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Contact</h4>
            <ul className="flex flex-col gap-4">
              <li>
                <a href="mailto:hello@opportunityradar.com" className="group flex items-center gap-3 text-sm text-slate-400 hover:text-blue-500 transition-colors duration-200">
                  <Mail className="w-4 h-4 group-hover:text-blue-500" />
                  hello@opportunityradar.com
                </a>
              </li>
              <li>
                <Link href="/support" className="group flex items-center gap-3 text-sm text-slate-400 hover:text-blue-500 transition-colors duration-200">
                  <MessageCircle className="w-4 h-4 group-hover:text-blue-500" />
                  Support Center
                </Link>
              </li>
              <li>
                <Link href="#feature-global-chat" className="group flex items-center gap-3 text-sm text-slate-400 hover:text-blue-500 transition-colors duration-200">
                  <MapPin className="w-4 h-4 group-hover:text-blue-500" />
                  Global Community
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-slate-800/80 mb-6" />

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
          {/* Social Icons */}
          <div className="flex items-center gap-6">
            <a href="https://github.com/Laxmansirvi05/opportunity-radar" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-500 transition-colors duration-200" aria-label="GitHub">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
              </svg>
            </a>
          </div>

          {/* Copyright + legal links */}
          <div className="flex flex-col sm:flex-row items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <p>© {currentYear} Opportunity Radar. All rights reserved.</p>
            <span className="hidden sm:inline text-slate-700">·</span>
            <Link href="/privacy" className="hover:text-blue-500 transition-colors duration-200">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-blue-500 transition-colors duration-200">Terms &amp; Conditions</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
