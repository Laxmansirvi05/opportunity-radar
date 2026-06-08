'use client'

import { useState } from 'react'
import { markAsApplied } from '@/app/actions/tracker'

interface ApplyWorkflowButtonProps {
  opportunityId: string
  applyUrl: string
  expired: boolean
}

export function ApplyWorkflowButton({ opportunityId, applyUrl, expired }: ApplyWorkflowButtonProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  const handleApplyClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (expired) return
    
    // Open URL in new tab
    window.open(applyUrl, '_blank', 'noopener,noreferrer')
    
    // Show confirmation dialog
    setShowDialog(true)
  }

  const handleConfirm = async () => {
    setIsApplying(true)
    try {
      await markAsApplied(opportunityId)
    } catch (error) {
      console.error(error)
    } finally {
      setIsApplying(false)
      setShowDialog(false)
    }
  }

  if (expired) {
    return (
      <button 
        disabled 
        className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-surface-variant text-on-surface-variant font-bold shadow-sm w-full opacity-60 cursor-not-allowed"
      >
        Application Closed
      </button>
    )
  }

  return (
    <>
      <button 
        onClick={handleApplyClick}
        className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 transition-colors shadow-sm w-full cursor-pointer"
      >
        Apply Now
        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
      </button>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-[384px] shadow-lg flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-bold text-on-background">Application Tracker</h3>
            <p className="text-sm text-on-surface-variant">
              Have you applied for this opportunity?
            </p>
            <div className="flex justify-end gap-3 mt-2">
              <button 
                onClick={() => setShowDialog(false)}
                disabled={isApplying}
                className="px-4 py-2 rounded-lg font-bold text-on-surface-variant hover:bg-surface-variant transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirm}
                disabled={isApplying}
                className="px-4 py-2 rounded-lg font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer"
              >
                {isApplying ? (
                  <>
                    <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                    Saving...
                  </>
                ) : 'Yes, I Applied'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
