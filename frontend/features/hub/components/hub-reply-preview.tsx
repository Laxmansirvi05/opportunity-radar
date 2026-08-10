import React from 'react'

interface HubReplyPreviewProps {
  senderName: string | null
  content: string
  onClose?: () => void
}

export function HubReplyPreview({ senderName, content, onClose }: HubReplyPreviewProps) {
  return (
    <div className="flex items-center justify-between bg-surface-container rounded-lg p-2 mb-2 border-l-4 border-primary text-sm shadow-sm opacity-90 relative">
      <div className="flex flex-col min-w-0 pr-6">
        <span className="font-semibold text-primary truncate">
          {senderName ?? 'Someone'}
        </span>
        <span className="text-on-surface-variant truncate">
          {content}
        </span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1 cursor-pointer rounded-md hover:bg-surface-container-high transition-colors flex-shrink-0"
          aria-label="Cancel reply"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      )}
    </div>
  )
}
