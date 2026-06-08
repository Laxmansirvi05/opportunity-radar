'use client'

import { useState } from 'react'
import { deleteAccountAction } from '@/app/actions/settings'

export function DeleteAccountButton() {
  const [showDialog, setShowDialog] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (confirmation !== 'DELETE') return
    
    setIsDeleting(true)
    setError(null)
    
    try {
      const result = await deleteAccountAction()
      if (result?.error) {
        setError(result.error)
        setIsDeleting(false)
      }
      // If successful, the server action will redirect.
    } catch (err) {
      console.error(err)
      setError('An unexpected error occurred.')
      setIsDeleting(false)
    }
  }

  return (
    <>
      <button 
        onClick={() => setShowDialog(true)}
        className="inline-block text-sm px-4 py-2 bg-error/10 border border-error/20 text-error font-bold rounded-lg hover:bg-error/20 transition-colors cursor-pointer text-left"
      >
        Delete Account
      </button>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-2xl p-8 w-full max-w-[512px] shadow-lg flex flex-col gap-6 animate-in fade-in zoom-in-95 border border-error/20">
            <div className="flex items-center gap-2 text-error mb-2">
              <span className="material-symbols-outlined">warning</span>
              <h3 className="text-xl font-bold">Delete Account</h3>
            </div>
            
            <p className="text-sm text-on-surface-variant">
              You are about to permanently delete your account. This action will erase your profile, saved opportunities, tracker entries, uploaded resumes, and notification settings.
            </p>
            <p className="text-sm font-bold text-on-background">
              This action CANNOT be undone.
            </p>

            {error && (
              <div className="p-3 text-sm text-error bg-error/10 rounded-md border border-error/20">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2 mt-2">
              <label htmlFor="confirm-delete" className="text-sm font-medium text-on-surface-variant">
                Please type <strong className="text-error">DELETE</strong> to confirm.
              </label>
              <input 
                id="confirm-delete"
                type="text" 
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="DELETE"
                disabled={isDeleting}
                className="px-4 py-2 bg-surface border border-outline-variant rounded-lg text-on-background focus:outline-none focus:ring-2 focus:ring-error focus:border-transparent font-mono uppercase"
              />
            </div>

            <div className="flex justify-end gap-4 mt-4 pt-6 border-t border-outline-variant">
              <button 
                onClick={() => {
                  setShowDialog(false)
                  setConfirmation('')
                  setError(null)
                }}
                disabled={isDeleting}
                className="px-6 py-2 rounded-lg font-bold text-on-surface hover:bg-surface-variant transition-colors cursor-pointer border border-outline-variant"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirm}
                disabled={isDeleting || confirmation !== 'DELETE'}
                className="px-6 py-2 rounded-lg font-bold bg-error text-white hover:bg-error/90 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
