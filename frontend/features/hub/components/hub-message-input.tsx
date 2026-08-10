'use client'

import React, { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { HubReplyPreview } from './hub-reply-preview'
import type { HubMessage } from '../types'

interface PendingImage {
  file: File
  previewUrl: string
  width: number
  height: number
}

interface HubMessageInputProps {
  onSendMessage: (content: string, replyToId?: string | null, image?: { url: string; width: number; height: number } | null) => Promise<void>
  isSending: boolean
  replyingTo: HubMessage | null
  onCancelReply: () => void
}

const MAX_LENGTH = 2000
const MAX_IMAGE_SIZE = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = url
  })
}

export function HubMessageInput({ onSendMessage, isSending, replyingTo, onCancelReply }: HubMessageInputProps) {
  const [content, setContent] = useState('')
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
  }, [content])

  // Focus textarea when reply is initiated
  useEffect(() => {
    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [replyingTo])

  // Revoke the object URL when the pending image changes or unmounts
  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl)
    }
  }, [pendingImage])

  const handlePickImage = () => fileInputRef.current?.click()

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setImageError(null)

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setImageError('Please choose a JPEG, PNG, WebP, or GIF image.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError('Image must be under 8MB.')
      return
    }

    try {
      const { width, height } = await readImageDimensions(file)
      setPendingImage({ file, previewUrl: URL.createObjectURL(file), width, height })
    } catch {
      setImageError('Could not read that image. Try a different file.')
    }
  }

  const clearPendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl)
    setPendingImage(null)
    setImageError(null)
  }

  const handleSend = async () => {
    const trimmed = content.trim()
    if (isSending || isUploading) return
    if (!trimmed && !pendingImage) return
    if (trimmed.length > MAX_LENGTH) return

    const imageToSend = pendingImage
    setContent('')
    setPendingImage(null)
    onCancelReply()

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    let uploadedImage: { url: string; width: number; height: number } | null = null

    if (imageToSend) {
      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', imageToSend.file)
        const res = await fetch('/api/hub/upload', { method: 'POST', body: formData })
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: 'Upload failed' }))
          throw new Error(error ?? 'Upload failed')
        }
        const { url } = await res.json()
        uploadedImage = { url, width: imageToSend.width, height: imageToSend.height }
      } catch (err) {
        setImageError(err instanceof Error ? err.message : 'Failed to upload image')
        setIsUploading(false)
        // Restore the draft so the user doesn't lose their caption
        setContent(trimmed)
        setPendingImage(imageToSend)
        return
      }
      setIsUploading(false)
      URL.revokeObjectURL(imageToSend.previewUrl)
    }

    await onSendMessage(trimmed, replyingTo?.id, uploadedImage)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isOverLimit = content.length > MAX_LENGTH
  const remaining = MAX_LENGTH - content.length
  const canSend = (!!content.trim() || !!pendingImage) && !isOverLimit && !isSending && !isUploading

  return (
    <div className="bg-surface border-t border-outline-variant/60 px-3 py-3 md:px-4 md:py-4 shrink-0">
      <div className="max-w-4xl mx-auto">
        {replyingTo && (
          <div className="mb-2">
            <HubReplyPreview
              senderName={replyingTo.sender.name}
              content={replyingTo.image_url && !replyingTo.content ? 'Photo' : replyingTo.content}
              onClose={onCancelReply}
            />
          </div>
        )}

        {imageError && (
          <div className="mb-2 text-xs font-medium text-error bg-error-container/40 rounded-lg px-3 py-1.5">
            {imageError}
          </div>
        )}

        {pendingImage && (
          <div className="mb-2 flex items-start gap-2">
            <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-outline-variant shrink-0 bg-surface-container">
              <Image src={pendingImage.previewUrl} alt="Selected image" fill className="object-cover" sizes="80px" unoptimized />
              <button
                onClick={clearPendingImage}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
                aria-label="Remove image"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
            {isUploading && (
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
                <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                Uploading...
              </div>
            )}
          </div>
        )}

        <div className="relative flex items-end gap-1.5 bg-surface-container rounded-2xl p-1.5 border focus-within:border-primary border-transparent transition-colors shadow-sm">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleImageSelected}
          />
          <button
            onClick={handlePickImage}
            disabled={isSending || isUploading}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Attach image"
            title="Attach image"
          >
            <span className="material-symbols-outlined text-[22px]">add_photo_alternate</span>
          </button>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 max-h-[150px] min-h-[40px] bg-transparent border-none focus:ring-0 resize-none py-2 px-1.5 text-on-surface placeholder:text-on-surface-variant text-[15px]"
            disabled={isSending}
            rows={1}
          />

          <div className="flex flex-col items-center justify-end pb-0.5 shrink-0">
            {remaining <= 100 && (
              <span className={`text-[10px] font-medium mb-1 ${isOverLimit ? 'text-error' : 'text-on-surface-variant'}`}>
                {remaining}
              </span>
            )}

            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all cursor-pointer shrink-0
                ${canSend
                  ? 'bg-primary text-on-primary shadow-sm hover:opacity-90'
                  : 'bg-surface-variant text-on-surface-variant opacity-50 cursor-not-allowed'
                }
              `}
              aria-label="Send message"
            >
              {isUploading ? (
                <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
              ) : (
                <span className="material-symbols-outlined text-[20px]">send</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
