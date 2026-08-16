'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { deleteAttachment, listAttachments } from '../services/notes-client'
import type { NoteAttachment } from '../types'

interface AttachmentsViewProps {
  onOpenNote: (noteId: string) => void
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Every image and file across all notes, newest first.
 *
 * Deleting here removes the stored object but deliberately leaves the note's
 * own markup alone — silently rewriting someone's document from a file
 * manager would be a surprising edit.
 */
export function AttachmentsView({ onOpenNote }: AttachmentsViewProps) {
  const [filter, setFilter] = useState<'all' | 'image' | 'file'>('all')
  // Keyed by the filter the rows were fetched for, so "still loading" is
  // derived from the data rather than tracked as a second piece of state that
  // has to be set synchronously inside the effect.
  const [loaded, setLoaded] = useState<{ filter: 'all' | 'image' | 'file'; rows: NoteAttachment[] } | null>(null)
  const isLoading = loaded?.filter !== filter
  const attachments = loaded?.filter === filter ? loaded.rows : []

  useEffect(() => {
    let cancelled = false
    listAttachments(filter === 'all' ? undefined : filter)
      .then((rows) => { if (!cancelled) setLoaded({ filter, rows }) })
      .catch(() => {
        if (cancelled) return
        toast.error('Could not load attachments.')
        setLoaded({ filter, rows: [] })
      })
    return () => { cancelled = true }
  }, [filter])

  const remove = useCallback(async (attachment: NoteAttachment) => {
    try {
      await deleteAttachment(attachment.id)
      setLoaded((prev) => (prev ? { ...prev, rows: prev.rows.filter((item) => item.id !== attachment.id) } : prev))
      toast.success('Attachment deleted')
    } catch {
      toast.error('Could not delete the attachment.')
    }
  }, [])

  if (isLoading) {
    return <p className="py-10 text-center font-body-md text-body-md text-on-surface-variant">Loading attachments…</p>
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-4">
        {([
          { value: 'all', label: 'All' },
          { value: 'image', label: 'Images' },
          { value: 'file', label: 'Files' },
        ] as const).map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={`h-8 px-3 rounded-full font-label-md text-label-md cursor-pointer transition-colors ${
              filter === option.value
                ? 'bg-primary-container text-on-primary-container'
                : 'text-on-surface-variant hover:bg-surface-container border border-outline-variant'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-outline-variant py-12 px-6">
          <span className="material-symbols-outlined text-[32px] text-on-surface-variant mb-2">attach_file</span>
          <h2 className="font-title-md text-title-md text-on-surface">No attachments yet</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm mt-1">
            Images and files you add to a note collect here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {attachments.map((attachment) => (
            <figure key={attachment.id} className="group relative rounded-2xl border border-outline-variant bg-surface-container-low overflow-hidden">
              {attachment.kind === 'image' ? (
                <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block h-28 bg-cover bg-center" style={{ backgroundImage: `url(${attachment.url})` }} aria-label={`Open ${attachment.name}`} />
              ) : (
                <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="h-28 grid place-items-center bg-surface-container" aria-label={`Open ${attachment.name}`}>
                  <span className="material-symbols-outlined text-[28px] text-on-surface-variant">description</span>
                </a>
              )}

              <figcaption className="p-2">
                <p className="font-label-md text-label-md text-on-surface truncate" title={attachment.name}>{attachment.name}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  {formatSize(attachment.size_bytes)}
                  {attachment.note_title && ' · '}
                  {attachment.note_title && (
                    <button
                      type="button"
                      onClick={() => attachment.note_id && onOpenNote(attachment.note_id)}
                      className="underline cursor-pointer hover:text-on-surface"
                    >
                      {attachment.note_title}
                    </button>
                  )}
                </p>
              </figcaption>

              <button
                type="button"
                aria-label={`Delete ${attachment.name}`}
                onClick={() => remove(attachment)}
                className="absolute top-1.5 right-1.5 h-7 w-7 grid place-items-center rounded-full bg-surface/90 text-error opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer transition-opacity"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
