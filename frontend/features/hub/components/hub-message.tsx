'use client'

import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import type { HubMessage, HubSender } from '../types'

interface HubMessageProps {
  message: HubMessage
  isOwn: boolean
  showAvatarAndName: boolean
  onProfileClick: (senderId: string, sender: HubSender) => void
  onReplyClick: (messageId: string) => void
  onDeleteClick?: (messageId: string) => void
  onEditSave?: (messageId: string, newContent: string) => void
  onReplyPreviewClick?: (replyToId: string) => void
  onImageClick?: (url: string) => void
}

export function HubMessageItem({
  message,
  isOwn,
  showAvatarAndName,
  onProfileClick,
  onReplyClick,
  onDeleteClick,
  onEditSave,
  onReplyPreviewClick,
  onImageClick,
}: HubMessageProps) {
  const { sender, content, created_at, reply_preview, optimistic, failed, image_url, image_width, image_height, edited_at } = message

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(content)
  const editRef = useRef<HTMLTextAreaElement>(null)

  // The action menu (Reply/Edit/Delete) is hover-only by default, which never
  // triggers on touch devices — on a chat feature, where mobile is the
  // primary way anyone actually uses it, that meant those actions were
  // simply unreachable there. Tapping the bubble also toggles it, closed by
  // tapping anywhere outside.
  const [showActions, setShowActions] = useState(false)
  const bubbleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showActions) return
    const onPointerDown = (e: PointerEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        setShowActions(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [showActions])

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus()
      editRef.current.setSelectionRange(editRef.current.value.length, editRef.current.value.length)
    }
  }, [isEditing])

  const initial = sender.name ? sender.name.charAt(0).toUpperCase() : 'U'
  const displayName = sender.name ?? 'Student'

  // Format time (e.g. 10:42 AM) safely for Safari which requires 'T' in ISO dates.
  // toLocaleTimeString() depends on the runtime's timezone/locale, which the
  // server and the viewer's browser will not generally agree on — computing
  // it during the initial render (including SSR) caused a real hydration
  // mismatch on every message. Deferred to a client-only effect instead; the
  // server and the client's first paint both render the placeholder, so they
  // always match, and the real local time fills in a moment after mount.
  const [timeString, setTimeString] = useState('…')
  useEffect(() => {
    if (!created_at) return
    const d = new Date(created_at.replace(' ', 'T'))
    if (!isNaN(d.getTime())) {
      // This IS the fix for the hydration mismatch described above, not the
      // bug the rule below is guarding against — toLocaleTimeString() has no
      // server-safe fallback to compute during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeString(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }
  }, [created_at])

  const aspectRatio = image_width && image_height ? image_width / image_height : 4 / 3

  const startEdit = () => {
    setEditValue(content)
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditValue(content)
  }

  const saveEdit = () => {
    const trimmed = editValue.trim()
    if (!trimmed && !image_url) return // a text-only message cannot be edited to empty
    if (trimmed !== content) {
      onEditSave?.(message.id, trimmed)
    }
    setIsEditing(false)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  return (
    <div className={`flex w-full gap-2 group ${isOwn ? 'justify-end' : 'justify-start'} ${showAvatarAndName ? 'mt-2.5' : 'mt-0.5'}`}>
      {/* Other's Avatar */}
      {!isOwn && (
        <div className="w-8 flex-shrink-0 flex justify-center">
          {showAvatarAndName && (
            <button
              onClick={() => onProfileClick(message.sender_id, sender)}
              className="relative w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs overflow-hidden border border-outline-variant/30 hover:opacity-80 transition-opacity cursor-pointer shrink-0"
              aria-label={`View ${displayName}'s profile`}
            >
              {sender.avatar_url ? (
                <Image src={sender.avatar_url} alt={displayName} fill className="object-cover" sizes="32px" />
              ) : (
                initial
              )}
            </button>
          )}
        </div>
      )}

      {/* Message Bubble Container */}
      <div className={`flex flex-col max-w-[85%] md:max-w-[65%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Sender Name */}
        {!isOwn && showAvatarAndName && (
          <button
            onClick={() => onProfileClick(message.sender_id, sender)}
            className="text-xs font-semibold text-on-surface-variant mb-0.5 ml-1 hover:text-primary transition-colors cursor-pointer text-left"
          >
            {displayName}
          </button>
        )}

        {/* Bubble */}
        <div ref={bubbleRef} className={`relative flex flex-col group/bubble ${isOwn ? 'items-end' : 'items-start'}`}>
          {/* Action Menu (Reply/Edit/Delete) — visible on hover (mouse) or tap
              (touch). Positioned above the bubble, not to its side: a side
              position (right-full/left-full) can clip off the edge of a
              narrow phone screen, which is where this matters most. */}
          {!isEditing && (
            <div className={`absolute -top-10 ${isOwn ? 'right-0' : 'left-0'} transition-opacity flex items-center gap-1 bg-surface-container-low border border-outline-variant rounded-lg p-1 shadow-sm z-10 ${showActions ? 'opacity-100' : 'opacity-0 group-hover/bubble:opacity-100'}`}>
              <button
                onClick={() => { onReplyClick(message.id); setShowActions(false) }}
                className="w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-md transition-colors cursor-pointer"
                title="Reply"
              >
                <span className="material-symbols-outlined text-[18px]">reply</span>
              </button>
              {isOwn && onEditSave && (
                <button
                  onClick={() => { startEdit(); setShowActions(false) }}
                  className="w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-md transition-colors cursor-pointer"
                  title="Edit"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
              )}
              {isOwn && onDeleteClick && (
                <button
                  onClick={() => { onDeleteClick(message.id); setShowActions(false) }}
                  className="w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 rounded-md transition-colors cursor-pointer"
                  title="Delete"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              )}
            </div>
          )}

          <div
            onClick={() => { if (!isEditing) setShowActions(v => !v) }}
            className={`
              flex flex-col rounded-2xl overflow-hidden
              ${image_url ? 'p-1' : 'px-3 py-1.5'}
              ${isOwn
                ? 'bg-primary text-on-primary rounded-tr-sm'
                : 'bg-surface border border-outline-variant rounded-tl-sm text-on-surface'
              }
              ${optimistic ? 'opacity-70' : ''}
              ${failed ? 'border-error bg-error-container text-on-error-container' : ''}
              ${isEditing ? 'ring-2 ring-primary/50' : 'cursor-pointer'}
            `}
          >
            {/* Reply Preview inside bubble */}
            {reply_preview && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (message.reply_to_id) onReplyPreviewClick?.(message.reply_to_id)
                }}
                className={`flex flex-col text-left mb-1 pl-2 border-l-4 rounded-r-md py-0.5 px-2 text-xs max-w-full cursor-pointer hover:opacity-80 transition-opacity
                  ${image_url ? 'mx-1 mt-1' : ''}
                  ${isOwn ? 'border-on-primary/50 bg-black/10 text-on-primary' : 'border-primary bg-surface-container text-on-surface-variant'}
                `}
              >
                <span className="font-semibold text-xs opacity-90 truncate w-full">
                  {reply_preview.sender_name ?? 'Someone'}
                </span>
                <span className="truncate w-full text-xs opacity-90">
                  {reply_preview.content}
                </span>
              </button>
            )}

            {/* Image */}
            {image_url && (
              <button
                onClick={(e) => { e.stopPropagation(); onImageClick?.(image_url) }}
                // A fixed width, not w-full: next/image's `fill` mode makes the
                // <img> absolutely positioned, so it contributes zero intrinsic
                // size to this button — combined with a flex-col ancestor that
                // has no definite width of its own, a percentage width here
                // resolves to 0 and the whole bubble collapses to a dot.
                className="relative w-[240px] max-h-[320px] rounded-xl overflow-hidden cursor-zoom-in bg-black/5 block"
                style={{ aspectRatio, maxHeight: 320 }}
              >
                <Image
                  src={image_url}
                  alt="Shared image"
                  fill
                  className="object-cover"
                  sizes="240px"
                  unoptimized
                />
                {!content && (
                  <span className="absolute bottom-1.5 right-2 text-[10px] font-medium text-white bg-black/40 rounded-full px-2 py-0.5 backdrop-blur-sm">
                    {timeString}{edited_at ? ' · edited' : ''}
                  </span>
                )}
              </button>
            )}

            {/* Content / Edit field */}
            {isEditing ? (
              <div className={`flex flex-col gap-1.5 ${image_url ? 'px-2 pt-1.5' : ''}`}>
                <textarea
                  ref={editRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  rows={1}
                  className={`resize-none rounded-lg px-2 py-1 text-[14.5px] leading-snug min-w-[160px] focus:outline-none focus:ring-1 focus:ring-primary
                    ${isOwn ? 'bg-black/10 text-on-primary placeholder:text-on-primary/60' : 'bg-surface-container text-on-surface'}
                  `}
                />
                <div className="flex items-center justify-end gap-2 pb-1">
                  <button onClick={cancelEdit} className="text-xs font-medium opacity-80 hover:opacity-100 cursor-pointer">Cancel</button>
                  <button onClick={saveEdit} className="text-xs font-semibold px-2 py-0.5 rounded-md bg-black/15 hover:bg-black/25 cursor-pointer">Save</button>
                </div>
              </div>
            ) : (
              content && (
                <span className={`whitespace-pre-wrap break-words text-[14.5px] leading-snug ${image_url ? 'px-2 pt-1.5' : ''}`}>
                  {content}
                </span>
              )
            )}

            {/* Timestamp (skip when it's already overlaid on an image-only message) */}
            {!isEditing && !(image_url && !content) && (
              <div className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] font-medium opacity-70 ${image_url ? 'px-2 pb-1' : ''} ${isOwn ? 'text-on-primary' : 'text-on-surface-variant'}`}>
                {edited_at && <span className="italic">edited</span>}
                {timeString}
                {optimistic && <span className="material-symbols-outlined text-[12px] animate-spin">sync</span>}
                {failed && <span className="material-symbols-outlined text-[12px] text-error">error</span>}
              </div>
            )}
          </div>

          {/* Failed Error Message */}
          {failed && (
            <span className="text-xs text-error mt-1 mr-1">Failed to send</span>
          )}
        </div>
      </div>
    </div>
  )
}
