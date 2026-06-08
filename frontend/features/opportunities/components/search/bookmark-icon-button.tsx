'use client'

import { useBookmark } from '../../hooks/use-bookmark'

interface BookmarkIconButtonProps {
  opportunityId: string
}

export function BookmarkIconButton({ opportunityId }: BookmarkIconButtonProps) {
  const { isSaved, isLoading, toggleSave } = useBookmark(opportunityId)

  return (
    <button
      onClick={toggleSave}
      disabled={isLoading}
      className={`p-2 rounded-full transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center ${
        isSaved 
          ? 'text-primary bg-primary/10' 
          : 'text-on-surface-variant hover:text-primary hover:bg-primary/5'
      }`}
      aria-label={isSaved ? "Remove from saved" : "Bookmark this opportunity"}
      title={isSaved ? "Saved" : "Save for later"}
    >
      <span className="material-symbols-outlined text-[24px]">
        {isSaved ? 'bookmark' : 'bookmark_border'}
      </span>
    </button>
  )
}
