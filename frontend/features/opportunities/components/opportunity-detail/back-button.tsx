'use client'

import { useRouter } from 'next/navigation'

export function BackButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-2 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
    >
      <span className="material-symbols-outlined text-[18px]">arrow_back</span>
      Back to Opportunities
    </button>
  )
}
