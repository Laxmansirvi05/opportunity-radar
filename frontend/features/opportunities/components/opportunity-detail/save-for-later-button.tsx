'use client'

import { useBookmark } from '../../hooks/use-bookmark'

interface SaveForLaterButtonProps {
  opportunityId: string
  expired?: boolean
}

export function SaveForLaterButton({ opportunityId, expired }: SaveForLaterButtonProps) {
  const { isSaved, isLoading, toggleSave } = useBookmark(opportunityId)

  const handleToggle = () => {
    if (!expired) toggleSave()
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading || expired}
      className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold border transition-colors shadow-sm w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        isSaved 
          ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20' 
          : 'bg-surface text-on-surface border-outline-variant hover:bg-surface-container-low'
      }`}
      aria-label={isSaved ? 'Remove from saved' : 'Save for later'}
      title={expired ? "Cannot save expired opportunities" : undefined}
    >
      <span className="material-symbols-outlined text-[20px]">
        {isSaved ? 'bookmark' : 'bookmark_border'}
      </span>
      {isSaved ? 'Saved for Later' : 'Save for Later'}
    </button>
  )
}
