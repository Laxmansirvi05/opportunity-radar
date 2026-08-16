'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createConversation,
  fetchConversations,
  fetchMessages,
  insertMessage,
  sendChatMessage,
  updateConversationTitle,
} from '@/features/ai-assistant/services/api'
import type { ChatMessage } from '@/features/ai-assistant/types'
import { usePanelResize, type PanelSize } from './use-panel-resize'
import { PanelResizeHandle } from './panel-resize-handle'

const DEFAULT_SIZE: PanelSize = { width: 360, height: 440 }
const GAP = 12
const VIEWPORT_PADDING = 12
const TITLE_MAX = 60

interface QuickAssistantProps {
  anchor: { x: number; y: number; size: number }
  onClose: () => void
}

interface HistoryEntry {
  id: string
  title: string
}

function computePosition(anchor: QuickAssistantProps['anchor'], size: PanelSize) {
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Opens above-right of the robot by preference, mirroring the Quick Note's
  // above-left, so the two can sit open side by side rather than on top of
  // each other — always clamped inside the viewport.
  const preferAbove = anchor.y > size.height + GAP + VIEWPORT_PADDING
  const top = preferAbove ? anchor.y - size.height - GAP : anchor.y + anchor.size + GAP
  const left = anchor.x + anchor.size + GAP + size.width < vw
    ? anchor.x + anchor.size + GAP
    : anchor.x - size.width - GAP

  return clampToViewport(top, left, size, vw, vh)
}

function clampToViewport(top: number, left: number, size: PanelSize, vw = window.innerWidth, vh = window.innerHeight) {
  const maxTop = Math.max(VIEWPORT_PADDING, vh - size.height - VIEWPORT_PADDING)
  const maxLeft = Math.max(VIEWPORT_PADDING, vw - size.width - VIEWPORT_PADDING)
  return {
    top: Math.min(Math.max(top, VIEWPORT_PADDING), maxTop),
    left: Math.min(Math.max(left, VIEWPORT_PADDING), maxLeft),
  }
}

/**
 * The robot's double-tap Quick Assistant.
 *
 * This is not a second AI assistant. It calls the same `/api/assistant` route
 * through the same client the Assistant page uses, and persists into the same
 * `chat_conversations`/`chat_messages` tables — only tagged `source: 'quick'`
 * so its history can be listed separately and capped.
 *
 * Deliberately no suggestion chips and no quick prompts: this is a "type the
 * thing, get the answer" surface. The brevity of the answer is enforced by the
 * route, not by truncating text here.
 */
export function QuickAssistant({ anchor, onClose }: QuickAssistantProps) {
  const { size, isResizing, panelRef, startResize, onResizeMove, endResize, resetSize } =
    usePanelResize('robot_quick_assistant_size_v1', DEFAULT_SIZE)
  // Read by the drag/resize handlers so they clamp against the live size
  // without being rebuilt on every resize frame.
  const sizeRef = useRef(size)
  useEffect(() => { sizeRef.current = size }, [size])

  const [style, setStyle] = useState(() => computePosition(anchor, DEFAULT_SIZE))
  const [isDragging, setIsDragging] = useState(false)
  const hasMovedRef = useRef(false)
  const dragOriginRef = useRef<{ pointerX: number; pointerY: number; top: number; left: number } | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchConversations('quick')
      .then((rows) => {
        if (cancelled) return
        setHistory(rows.map((row) => ({ id: row.id, title: row.title })))
      })
      .catch(() => { /* an empty history list is survivable */ })
    return () => { cancelled = true }
  }, [])

  // Scrolls the transcript as it grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isSending])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isHistoryOpen) setIsHistoryOpen(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isHistoryOpen, onClose])

  useEffect(() => {
    const onResize = () => {
      setStyle((prev) => (hasMovedRef.current
        ? clampToViewport(prev.top, prev.left, sizeRef.current)
        : computePosition(anchor, sizeRef.current)))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startDrag = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('button, input, textarea, [contenteditable="true"]')) return
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    dragOriginRef.current = { pointerX: event.clientX, pointerY: event.clientY, top: style.top, left: style.left }
    setIsDragging(true)
  }, [style.left, style.top])

  const onDragMove = useCallback((event: React.PointerEvent) => {
    const origin = dragOriginRef.current
    if (!origin) return
    hasMovedRef.current = true
    setStyle(clampToViewport(
      origin.top + (event.clientY - origin.pointerY),
      origin.left + (event.clientX - origin.pointerX),
      sizeRef.current
    ))
  }, [])

  const endDrag = useCallback((event: React.PointerEvent) => {
    if (!dragOriginRef.current) return
    ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
    dragOriginRef.current = null
    setIsDragging(false)
  }, [])

  const openHistoryChat = useCallback(async (id: string) => {
    setIsHistoryOpen(false)
    setError(null)
    setConversationId(id)
    try {
      setMessages(await fetchMessages(id))
    } catch {
      setError('Could not load that chat.')
    }
  }, [])

  const startNewChat = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setError(null)
    setIsHistoryOpen(false)
    inputRef.current?.focus()
  }, [])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || isSending) return

    setInput('')
    setError(null)
    setIsSending(true)

    const userMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
      time: new Date().toISOString(),
    }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)

    try {
      // The conversation row is created on the first real message, not when
      // the popup opens — opening and closing without typing leaves nothing
      // behind, same rule as the Quick Note's draft.
      let activeId = conversationId
      if (!activeId) {
        const created = await createConversation(text.slice(0, TITLE_MAX), 'quick')
        activeId = created?.id ?? null
        if (activeId) {
          setConversationId(activeId)
          setHistory((prev) => [{ id: activeId!, title: text.slice(0, TITLE_MAX) }, ...prev].slice(0, 6))
        }
      }

      if (activeId) await insertMessage(activeId, 'user', text)

      const reply = await sendChatMessage(
        nextMessages.map((message) => ({ role: message.role, content: message.content })),
        'quick'
      )

      if (reply.error || !reply.text) {
        setError(reply.error ?? 'No reply came back. Please try again.')
        return
      }

      const aiMessage: ChatMessage = {
        id: `local-${Date.now()}-ai`,
        role: 'ai',
        content: reply.text,
        time: new Date().toISOString(),
        opportunities: reply.opportunities,
      }
      setMessages((prev) => [...prev, aiMessage])

      if (activeId) {
        await insertMessage(activeId, 'ai', reply.text, reply.opportunities)
        // Keeps this chat at the top of the quick history list.
        await updateConversationTitle(activeId, (nextMessages[0]?.content ?? text).slice(0, TITLE_MAX))
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSending(false)
    }
  }, [conversationId, input, isSending, messages])

  return (
    <>
      <button
        type="button"
        aria-label="Close quick assistant"
        onClick={onClose}
        className="fixed inset-0 z-[9997] cursor-default"
        style={{ background: 'transparent' }}
      />

      <div
        role="dialog"
        aria-label="Quick assistant"
        ref={panelRef}
        style={{ position: 'fixed', top: style.top, left: style.left, width: size.width, height: size.height }}
        className={`relative z-[9999] bg-surface border border-outline-variant rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
          isDragging || isResizing ? 'shadow-[0_24px_48px_rgba(0,0,0,0.35)] select-none' : ''
        }`}
      >
        <div
          onPointerDown={startDrag}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ touchAction: 'none' }}
          className={`flex items-center gap-1 px-3 py-2.5 border-b border-outline-variant shrink-0 ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant" aria-hidden="true">drag_indicator</span>
          <h2 className="font-title-sm text-title-sm font-bold text-on-surface flex-1">Quick Assistant</h2>

          <button
            type="button"
            aria-label="New quick chat"
            title="New chat"
            onClick={startNewChat}
            className="h-7 w-7 grid place-items-center rounded-full text-on-surface-variant hover:bg-surface-container cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add_comment</span>
          </button>
          <button
            type="button"
            aria-label="Quick chat history"
            aria-expanded={isHistoryOpen}
            title="History"
            onClick={() => setIsHistoryOpen((open) => !open)}
            className={`h-7 w-7 grid place-items-center rounded-full cursor-pointer ${
              isHistoryOpen ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick assistant"
            className="h-7 w-7 grid place-items-center rounded-full text-on-surface-variant hover:bg-surface-container cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {isHistoryOpen && (
          <div className="border-b border-outline-variant bg-surface-container-low max-h-40 overflow-y-auto shrink-0">
            {history.length === 0 ? (
              <p className="px-3 py-3 font-body-sm text-body-sm text-on-surface-variant">No quick chats yet.</p>
            ) : (
              history.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => openHistoryChat(entry.id)}
                  className={`w-full text-left px-3 py-2 font-body-sm text-body-sm truncate cursor-pointer transition-colors ${
                    entry.id === conversationId
                      ? 'bg-primary-container text-on-primary-container'
                      : 'text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {entry.title || 'Untitled chat'}
                </button>
              ))
            )}
          </div>
        )}

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2.5">
          {messages.length === 0 && !isSending && (
            <div className="m-auto text-center px-2">
              <span className="material-symbols-outlined text-[26px] text-on-surface-variant">smart_toy</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Ask anything. Answers here are kept short — open the AI Assistant for the full version.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-2xl px-3 py-2 font-body-sm text-body-sm whitespace-pre-wrap break-words ${
                message.role === 'user'
                  ? 'self-end bg-primary text-on-primary rounded-br-md'
                  : 'self-start bg-surface-container text-on-surface rounded-bl-md'
              }`}
            >
              {message.content}

              {message.opportunities && message.opportunities.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {message.opportunities.slice(0, 3).map((opportunity) => (
                    <li key={opportunity.id}>
                      <a
                        href={`/opportunities/${opportunity.id}`}
                        className="flex items-center gap-1.5 rounded-lg bg-surface px-2 py-1 text-on-surface hover:bg-surface-container-high transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">work</span>
                        <span className="truncate font-label-sm text-label-sm">{opportunity.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {isSending && (
            <div className="self-start bg-surface-container rounded-2xl rounded-bl-md px-3 py-2" aria-live="polite">
              <span className="font-body-sm text-body-sm text-on-surface-variant">Thinking…</span>
            </div>
          )}

          {error && (
            <p className="self-start font-body-sm text-body-sm text-error" role="alert">{error}</p>
          )}
        </div>

        <div className="border-t border-outline-variant p-2 flex items-end gap-1.5 shrink-0">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Ask something…"
            aria-label="Message the quick assistant"
            className="flex-1 resize-none max-h-24 bg-transparent outline-none font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant px-2 py-1.5"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!input.trim() || isSending}
            aria-label="Send"
            className="h-8 w-8 grid place-items-center rounded-full bg-primary text-on-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>
          </button>
        </div>

        <PanelResizeHandle
          isResizing={isResizing}
          onPointerDown={startResize}
          onPointerMove={onResizeMove}
          onPointerUp={endResize}
          onDoubleClick={resetSize}
          label="Resize quick assistant"
        />
      </div>
    </>
  )
}
