'use client'

import { useBookmark } from '../../hooks/use-bookmark'

interface SaveForLaterButtonProps {
  opportunityId: string
}

export function SaveForLaterButton({ opportunityId }: SaveForLaterButtonProps) {
  const { isSaved, isLoading, toggleSave } = useBookmark(opportunityId)

  return (
    <button
      onClick={toggleSave}
      disabled={isLoading}
      className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold border hover:bg-surface-container-low transition-colors shadow-sm w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        isSaved 
          ? 'bg-primary/10 text-primary border-primary/20' 
          : 'bg-surface text-on-surface border-outline-variant'
      }`}
    >
      <span className="material-symbols-outlined text-[20px]">
        {isSaved ? 'bookmark' : 'bookmark_border'}
      </span>
      {isSaved ? 'Saved for Later' : 'Save for Later'}
    </button>
  )
}
