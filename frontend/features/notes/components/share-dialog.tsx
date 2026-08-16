'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { NoteShare, SharePermission } from '../types'
import { addShareRecipient, getShare, removeShareRecipient, setLinkAccess, stopSharing } from '../services/notes-client'

interface ShareDialogProps {
  noteId: string
  noteTitle: string
  onClose: () => void
  onChanged: (share: NoteShare | null) => void
}

/**
 * Sharing controls for one note.
 *
 * Link access offers Private and "anyone with the link can view" only —
 * anonymous editing is not offered because there would be no identity behind
 * the write. Editing is granted per person instead, where a real account
 * backs it and the database enforces the permission (notes_update_shared_with_me).
 */
export function ShareDialog({ noteId, noteTitle, onClose, onChanged }: ShareDialogProps) {
  const [share, setShare] = useState<NoteShare | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<SharePermission>('view')
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getShare(noteId)
      .then((result) => { if (!cancelled) setShare(result) })
      .catch(() => { if (!cancelled) toast.error('Could not load sharing settings.') })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [noteId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const apply = useCallback(
    async (work: () => Promise<NoteShare | null>, successMessage: string) => {
      setIsBusy(true)
      try {
        const next = await work()
        setShare(next)
        onChanged(next)
        toast.success(successMessage)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not update sharing.')
      } finally {
        setIsBusy(false)
      }
    },
    [onChanged]
  )

  const linkAccess = share?.link_access ?? 'private'
  const shareUrl = share?.slug ? `${window.location.origin}/notes/shared/${share.slug}` : null

  const copyLink = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied')
    } catch {
      // Clipboard access can be denied outright; showing the URL is better
      // than a silent no-op the user can't work around.
      toast.error(`Copy failed. The link is ${shareUrl}`)
    }
  }, [shareUrl])

  return (
    <div role="dialog" aria-modal="true" aria-label={`Share ${noteTitle || 'note'}`} className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-scrim/50 backdrop-blur-sm">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-2xl bg-surface-container-low border border-outline-variant shadow-2xl p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="font-title-md text-title-md text-on-surface">Share note</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{noteTitle || 'Untitled'}</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="h-8 w-8 grid place-items-center rounded-full text-on-surface-variant hover:bg-surface-container cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {isLoading ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant py-6 text-center">Loading…</p>
        ) : (
          <>
            <fieldset className="mb-4">
              <legend className="font-label-md text-label-md text-on-surface mb-2">Link access</legend>
              <div className="space-y-1.5">
                {([
                  { value: 'private', label: 'Private', hint: 'Only you and people you add below' },
                  { value: 'view', label: 'Anyone with the link', hint: 'Can view, but not edit' },
                ] as const).map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      linkAccess === option.value ? 'border-primary bg-primary-container/30' : 'border-outline-variant hover:bg-surface-container'
                    }`}
                  >
                    <input
                      type="radio"
                      name="link-access"
                      value={option.value}
                      checked={linkAccess === option.value}
                      disabled={isBusy}
                      onChange={() => apply(
                        () => setLinkAccess(noteId, option.value),
                        option.value === 'private' ? 'Link sharing turned off' : 'Anyone with the link can now view'
                      )}
                      className="mt-0.5 accent-[var(--color-primary)]"
                    />
                    <span className="min-w-0">
                      <span className="block font-label-lg text-label-lg text-on-surface">{option.label}</span>
                      <span className="block font-body-sm text-body-sm text-on-surface-variant">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              {linkAccess === 'view' && shareUrl && (
                <div className="flex items-center gap-2 mt-2 p-2 rounded-xl bg-surface-container border border-outline-variant">
                  <span className="font-body-sm text-body-sm text-on-surface-variant truncate flex-1">{shareUrl}</span>
                  <button type="button" onClick={copyLink} className="h-8 px-3 rounded-full bg-primary text-on-primary font-label-md text-label-md cursor-pointer shrink-0">
                    Copy
                  </button>
                </div>
              )}
            </fieldset>

            <div className="mb-3">
              <h3 className="font-label-md text-label-md text-on-surface mb-2">Specific people</h3>

              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!email.trim()) return
                  apply(async () => {
                    const next = await addShareRecipient(noteId, email.trim(), permission)
                    setEmail('')
                    return next
                  }, 'Note shared')
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  aria-label="Email address to share with"
                  autoComplete="email"
                  className="flex-1 min-w-0 h-9 px-3 rounded-full bg-surface-container border border-outline-variant font-body-sm text-body-sm text-on-surface outline-none focus:border-primary"
                />
                <select
                  value={permission}
                  onChange={(event) => setPermission(event.target.value as SharePermission)}
                  aria-label="Permission"
                  className="h-9 px-2 rounded-full bg-surface-container border border-outline-variant font-label-md text-label-md text-on-surface cursor-pointer outline-none"
                >
                  <option value="view">View</option>
                  <option value="edit">Edit</option>
                </select>
                <button type="submit" disabled={isBusy || !email.trim()} className="h-9 px-3 rounded-full bg-primary text-on-primary font-label-md text-label-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                  Add
                </button>
              </form>

              <ul className="mt-2 space-y-1">
                {(share?.recipients ?? []).map((recipient) => (
                  <li key={recipient.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-surface-container">
                    <span className="h-7 w-7 rounded-full bg-primary-container text-on-primary-container grid place-items-center font-label-md text-label-md shrink-0">
                      {(recipient.name ?? recipient.email ?? '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-label-md text-label-md text-on-surface truncate">{recipient.name ?? recipient.email ?? 'Unknown'}</span>
                      <span className="block font-body-sm text-body-sm text-on-surface-variant truncate">
                        {recipient.permission === 'edit' ? 'Can edit' : 'Can view'}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${recipient.name ?? recipient.email ?? 'recipient'}`}
                      disabled={isBusy}
                      onClick={() => apply(() => removeShareRecipient(noteId, recipient.recipient_id), 'Access removed')}
                      className="h-7 w-7 grid place-items-center rounded-full text-on-surface-variant hover:bg-error-container hover:text-on-error-container cursor-pointer shrink-0"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </li>
                ))}
                {(share?.recipients ?? []).length === 0 && (
                  <li className="font-body-sm text-body-sm text-on-surface-variant px-2 py-1">Not shared with anyone yet.</li>
                )}
              </ul>
            </div>

            {(linkAccess !== 'private' || (share?.recipients.length ?? 0) > 0) && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => apply(() => stopSharing(noteId), 'Sharing turned off')}
                className="w-full h-9 rounded-full border border-error text-error font-label-lg text-label-lg cursor-pointer hover:bg-error-container hover:text-on-error-container transition-colors disabled:opacity-40"
              >
                Stop sharing
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
