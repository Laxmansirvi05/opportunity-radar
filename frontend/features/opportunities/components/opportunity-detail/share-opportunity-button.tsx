'use client'

import { useState } from 'react'

export function ShareOpportunityButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Opportunity Radar - ${title}`,
          url: window.location.href,
        })
      } catch (err) {
        console.error('Share failed:', err)
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Clipboard failed:', err)
      }
    }
  }

  return (
    <button 
      onClick={handleShare}
      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-outline-variant text-on-surface-variant text-sm font-bold shadow-sm hover:bg-surface-container transition-colors cursor-pointer w-full"
    >
      <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'share'}</span>
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}
