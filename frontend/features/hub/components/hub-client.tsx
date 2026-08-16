'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useHubMessages } from '../hooks/use-hub-messages'
import { HubMessageItem } from './hub-message'
import { HubMessageInput } from './hub-message-input'
import { HubEmptyState } from './hub-empty-state'
import { HubProfileModal } from './hub-profile-modal'
import { HubImageLightbox } from './hub-image-lightbox'
import type { HubMessage, HubSender } from '../types'

interface HubClientProps {
  currentUserId: string
  currentUserSender: HubSender
  initialMessages: HubMessage[]
  initialHasMore: boolean
  initialError?: string | null
}

export function HubClient({ currentUserId, currentUserSender, initialMessages, initialHasMore, initialError }: HubClientProps) {
  const {
    messages,
    hasMore,
    isLoadingOlder,
    isSending,
    sendError,
    setSendError,
    realtimeStatus,
    onlineMembers,
    loadOlder,
    sendMessage,
    editMessage,
    deleteMessage,
  } = useHubMessages({ currentUserId, currentUserSender, initialMessages, initialHasMore })

  const [replyingTo, setReplyingTo] = useState<HubMessage | null>(null)
  const [profileModalSenderId, setProfileModalSenderId] = useState<string | null>(null)
  const [profileModalSender, setProfileModalSender] = useState<HubSender | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [clearedAt, setClearedAt] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    const stored = localStorage.getItem(`hub_cleared_at_${currentUserId}`)
    return stored ? parseInt(stored, 10) : 0
  })
  const [showMenu, setShowMenu] = useState(false)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleClearChat = () => {
    const now = Date.now()
    localStorage.setItem(`hub_cleared_at_${currentUserId}`, now.toString())
    setClearedAt(now)
    setShowMenu(false)
  }

  // Filter messages by clearedAt. A message with no usable created_at (seen
  // live from a malformed realtime payload — see the sender_id guard in
  // use-hub-messages.ts) must not crash this filter; defaulting to "visible"
  // is the safe direction, since a message we can't date should not be the
  // thing that silently disappears.
  const visibleMessages = messages.filter(m => {
    if (!m.created_at) return true
    const t = new Date(m.created_at.replace(' ', 'T')).getTime()
    return Number.isNaN(t) || t > clearedAt
  })

  // Auto-scroll to bottom on new messages if already near bottom
  const prevMessagesLength = useRef(visibleMessages.length)
  useEffect(() => {
    if (visibleMessages.length > prevMessagesLength.current) {
      const container = scrollContainerRef.current
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150
        const isNewOptimistic = visibleMessages[visibleMessages.length - 1]?.optimistic

        if (isNearBottom || isNewOptimistic || prevMessagesLength.current === 0) {
          requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight
          })
        }
      }
    }
    prevMessagesLength.current = visibleMessages.length
  }, [visibleMessages])

  // Scroll position preservation when loading older messages
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    if (container.scrollTop < 100 && !isLoadingOlder && hasMore) {
      const oldScrollHeight = container.scrollHeight
      loadOlder().then(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            const newScrollHeight = scrollContainerRef.current.scrollHeight
            scrollContainerRef.current.scrollTop = newScrollHeight - oldScrollHeight
          }
        })
      })
    }
  }

  const handleProfileClick = (senderId: string, sender: HubSender) => {
    setProfileModalSenderId(senderId)
    setProfileModalSender(sender)
  }

  const handleReplyClick = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId)
    if (msg) setReplyingTo(msg)
  }

  const handleReplyPreviewClick = (replyToId: string) => {
    const el = document.getElementById(`msg-${replyToId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('bg-primary-container/20')
      setTimeout(() => {
        el.classList.remove('bg-primary-container/20')
      }, 2000)
    }
  }

  const otherOnlineCount = onlineMembers.filter(m => m.user_id !== currentUserId).length

  return (
    <div className="flex flex-col h-full w-full bg-surface-container-lowest relative">
      {/* Header */}
      <header className="flex-shrink-0 h-16 border-b border-outline-variant/40 flex items-center justify-between px-3 md:px-6 bg-surface z-20 sticky top-0 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/dashboard"
            className="w-9 h-9 -ml-1 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer shrink-0"
            aria-label="Back to dashboard"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </Link>
          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">forum</span>
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-base font-bold text-on-surface leading-tight truncate">Hub</h1>
            <p className="text-xs text-on-surface-variant font-medium truncate">
              {realtimeStatus === 'connected'
                ? (otherOnlineCount > 0 ? `${otherOnlineCount} online` : 'Global Community Chat')
                : realtimeStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
            </p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(v => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
            aria-label="Chat options"
          >
            <span className="material-symbols-outlined text-[22px]">more_vert</span>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-11 z-20 bg-surface-container-low border border-outline-variant rounded-xl shadow-lg py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={handleClearChat}
                  className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">delete_sweep</span>
                  Clear chat for me
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Realtime Status Indicator */}
      {realtimeStatus === 'error' && (
        <div className="absolute top-[72px] left-1/2 -translate-x-1/2 z-10 bg-error-container text-on-error-container text-xs py-1 px-3 rounded-full opacity-90 shadow-sm">
          Connection lost. Retrying…
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 w-full min-w-0 overflow-y-auto px-2 py-4 md:px-4"
      >
        {initialError ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="material-symbols-outlined text-[48px] text-error mb-4">error</span>
            <h2 className="text-xl font-bold text-on-surface mb-2">Failed to load conversation</h2>
            <p className="text-on-surface-variant max-w-md">{initialError}</p>
          </div>
        ) : visibleMessages.length === 0 ? (
          <HubEmptyState />
        ) : (
          <div className="flex flex-col max-w-4xl mx-auto pb-2">
            {isLoadingOlder && (
              <div className="flex justify-center py-4">
                <span className="material-symbols-outlined animate-spin text-primary">sync</span>
              </div>
            )}

            {visibleMessages.map((msg, index) => {
              const isOwn = msg.sender_id === currentUserId
              const prevMsg = index > 0 ? visibleMessages[index - 1] : null
              const isConsecutive = prevMsg && prevMsg.sender_id === msg.sender_id

              let showAvatarAndName = !isConsecutive
              if (isConsecutive && prevMsg) {
                const timeDiff = new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()
                if (timeDiff > 5 * 60 * 1000) {
                  showAvatarAndName = true
                }
              }

              return (
                <div key={msg.id} id={`msg-${msg.id}`} className="transition-colors duration-500 rounded-lg">
                  <HubMessageItem
                    message={msg}
                    isOwn={isOwn}
                    showAvatarAndName={!!showAvatarAndName}
                    onProfileClick={handleProfileClick}
                    onReplyClick={handleReplyClick}
                    onDeleteClick={deleteMessage}
                    onEditSave={editMessage}
                    onReplyPreviewClick={handleReplyPreviewClick}
                    onImageClick={setLightboxUrl}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Error Toast */}
      {sendError && (
        <div className="bg-error text-on-error px-4 py-2 text-sm text-center flex items-center justify-center gap-2">
          {sendError}
          <button onClick={() => setSendError(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Input Area */}
      <HubMessageInput
        onSendMessage={sendMessage}
        isSending={isSending}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* Profile Modal */}
      {profileModalSenderId && profileModalSender && (
        <HubProfileModal
          senderId={profileModalSenderId}
          sender={profileModalSender}
          onClose={() => {
            setProfileModalSenderId(null)
            setProfileModalSender(null)
          }}
        />
      )}

      {/* Image Lightbox */}
      {lightboxUrl && (
        <HubImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  )
}
