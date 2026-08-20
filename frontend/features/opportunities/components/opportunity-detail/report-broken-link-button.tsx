'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface ReportBrokenLinkButtonProps {
  opportunityId: string
}

export function ReportBrokenLinkButton({ opportunityId }: ReportBrokenLinkButtonProps) {
  const [isReported, setIsReported] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const handleReport = async () => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast.error('Please sign in to report a broken link.')
      return
    }

    setIsLoading(true)

    const { error } = await supabase
      .from('reports')
      .insert({ opportunity_id: opportunityId, reported_by: user.id })

    // If it's a unique constraint error (user already reported), we can still show success.
    if (!error || error.code === '23505') {
      setIsReported(true)
    } else {
      toast.error('Failed to submit report. Please try again later.')
    }

    setIsLoading(false)
  }

  return (
    <button
      onClick={handleReport}
      disabled={isLoading || isReported}
      aria-label={isReported ? 'Report submitted' : 'Report broken link'}
      className={`mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors w-full ${
        isReported
          ? 'bg-green-50 text-green-700 border-green-200 cursor-default'
          : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container-low cursor-pointer'
      }`}
    >
      <span className="material-symbols-outlined text-[16px]">
        {isReported ? 'check_circle' : 'report'}
      </span>
      {isReported ? 'Report Submitted Successfully' : 'Report Broken Link'}
    </button>
  )
}
