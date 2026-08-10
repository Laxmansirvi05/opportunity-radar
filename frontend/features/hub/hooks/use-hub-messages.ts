'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { HubMessage, HubSender, PresenceMember } from '../types'

interface ImageAttachment {
  url: string
  width: number
  height: number
}

interface UseHubMessagesOptions {
  currentUserId: string
  currentUserSender: HubSender
  initialMessages: HubMessage[]
  initialHasMore: boolean
}

export function useHubMessages({
  currentUserId,
  currentUserSender,
  initialMessages,
  initialHasMore,
}: UseHubMessagesOptions) {
  const [messages, setMessages] = useState<HubMessage[]>(initialMessages)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'error'>('connecting')
  const [onlineMembers, setOnlineMembers] = useState<PresenceMember[]>([])

  // Track seen IDs to prevent optimistic + realtime duplicates
  const seenIds = useRef<Set<string>>(new Set(initialMessages.map(m => m.id)))
  // Cache sender profiles resolved during realtime delivery
  const senderCache = useRef<Map<string, HubSender>>(new Map())

  // Pre-populate cache with initial senders
  useEffect(() => {
    for (const m of initialMessages) {
      if (!senderCache.current.has(m.sender_id)) {
        senderCache.current.set(m.sender_id, m.sender)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only on mount — initialMessages is the SSR snapshot, not meant to re-seed the cache on every parent re-render

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('hub-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hub_messages' },
        async (payload) => {
          const raw = payload.new as {
            id: string
            sender_id: string
            content: string
            reply_to_id: string | null
            created_at: string
            image_url: string | null
            image_width: number | null
            image_height: number | null
            edited_at: string | null
          }

          // Deduplicate: skip if we already have this ID (optimistic or prior realtime)
          if (seenIds.current.has(raw.id)) {
            // Replace the optimistic entry with the canonical one to ensure correct ID
            setMessages(prev =>
              prev.map(m =>
                m.id === raw.id ? { ...m, optimistic: false, failed: false } : m
              )
            )
            return
          }

          seenIds.current.add(raw.id)

          // Resolve sender profile (cache-first)
          let sender = senderCache.current.get(raw.sender_id)
          if (!sender) {
            const { data } = await supabase
              .from('profiles')
              .select('name, avatar_url, email, linkedin_url')
              .eq('id', raw.sender_id)
              .single()

            sender = {
              name: data?.name ?? null,
              avatar_url: data?.avatar_url ?? null,
              email: data?.email ?? null,
              linkedin_url: data?.linkedin_url ?? null,
            }
            senderCache.current.set(raw.sender_id, sender)
          }

          // Resolve reply preview if needed
          let replyPreview = null
          if (raw.reply_to_id) {
            const { data: replyMsg } = await supabase
              .from('hub_messages')
              .select('content, sender_id')
              .eq('id', raw.reply_to_id)
              .single()

            if (replyMsg) {
              let replySenderName: string | null = null
              const cached = senderCache.current.get(replyMsg.sender_id)
              if (cached) {
                replySenderName = cached.name
              } else {
                const { data: rp } = await supabase
                  .from('profiles')
                  .select('name')
                  .eq('id', replyMsg.sender_id)
                  .single()
                replySenderName = rp?.name ?? null
              }
              replyPreview = { content: replyMsg.content, sender_name: replySenderName }
            }
          }

          const newMessage: HubMessage = {
            id: raw.id,
            sender_id: raw.sender_id,
            content: raw.content,
            reply_to_id: raw.reply_to_id,
            created_at: raw.created_at,
            sender,
            reply_preview: replyPreview,
            image_url: raw.image_url,
            image_width: raw.image_width,
            image_height: raw.image_height,
            edited_at: raw.edited_at,
          }

          setMessages(prev => [...prev, newMessage])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hub_messages' },
        (payload) => {
          const raw = payload.new as { id: string; content: string; edited_at: string | null }
          setMessages(prev =>
            prev.map(m => (m.id === raw.id ? { ...m, content: raw.content, edited_at: raw.edited_at } : m))
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'hub_messages' },
        (payload) => {
          const deletedId = (payload.old as { id?: string })?.id
          if (deletedId) {
            seenIds.current.delete(deletedId)
            setMessages(prev => prev.filter(m => m.id !== deletedId))
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceMember>()
        const members = Object.values(state)
          .flat()
          .map((p) => ({ user_id: p.user_id, name: p.name, avatar_url: p.avatar_url }))
        // De-duplicate by user_id — a user with multiple tabs open tracks
        // multiple presence entries under the same id.
        const unique = new Map(members.map((m) => [m.user_id, m]))
        setOnlineMembers([...unique.values()])
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected')
          await channel.track({
            user_id: currentUserId,
            name: currentUserSender.name,
            avatar_url: currentUserSender.avatar_url,
          })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error')
        } else {
          setRealtimeStatus('connecting')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — stable references via ref/props that don't change per-session

  // ── Load older messages ────────────────────────────────────────────────────
  const loadOlder = useCallback(async () => {
    if (isLoadingOlder || !hasMore || messages.length === 0) return

    const oldest = messages[0]
    setIsLoadingOlder(true)

    try {
      const params = new URLSearchParams({
        before_created_at: oldest.created_at,
        before_id: oldest.id,
      })
      const res = await fetch(`/api/hub/messages?${params}`)
      if (!res.ok) throw new Error('Failed to load older messages')
      const { messages: older, hasMore: moreAvailable }: { messages: HubMessage[]; hasMore: boolean } = await res.json()

      // Filter out any IDs we already have (page overlap guard)
      const newMessages = older.filter(m => !seenIds.current.has(m.id))
      for (const m of newMessages) {
        seenIds.current.add(m.id)
        if (!senderCache.current.has(m.sender_id)) {
          senderCache.current.set(m.sender_id, m.sender)
        }
      }

      setMessages(prev => [...newMessages, ...prev])
      setHasMore(moreAvailable)
    } catch (err) {
      console.error('[Hub] Load older failed:', err)
    } finally {
      setIsLoadingOlder(false)
    }
  }, [isLoadingOlder, hasMore, messages])

  // ── Send a message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (
    content: string,
    replyToId?: string | null,
    image?: ImageAttachment | null
  ) => {
    const trimmed = content.trim()
    if (!image && (!trimmed || trimmed.length > 2000)) return
    if (trimmed.length > 2000) return

    setSendError(null)
    setIsSending(true)

    // Optimistic message with a temporary ID
    const tempId = `optimistic-${Date.now()}`
    const optimisticMsg: HubMessage = {
      id: tempId,
      sender_id: currentUserId,
      content: trimmed,
      reply_to_id: replyToId ?? null,
      created_at: new Date().toISOString(),
      sender: currentUserSender,
      reply_preview: null, // will be filled on reconciliation
      image_url: image?.url ?? null,
      image_width: image?.width ?? null,
      image_height: image?.height ?? null,
      edited_at: null,
      optimistic: true,
    }

    seenIds.current.add(tempId)
    setMessages(prev => [...prev, optimisticMsg])

    try {
      const res = await fetch('/api/hub/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          reply_to_id: replyToId ?? null,
          image_url: image?.url ?? null,
          image_width: image?.width ?? null,
          image_height: image?.height ?? null,
        }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Failed to send')
      }

      const { message: canonical }: { message: HubMessage } = await res.json()

      seenIds.current.delete(tempId)
      seenIds.current.add(canonical.id)
      senderCache.current.set(canonical.sender_id, canonical.sender)

      // Replace optimistic entry with canonical
      setMessages(prev => {
        // If the realtime event already added this canonical.id, just remove the optimistic one
        if (prev.some(m => m.id === canonical.id && !m.optimistic)) {
          return prev.filter(m => m.id !== tempId)
        }
        return prev.map(m => (m.id === tempId ? { ...canonical, optimistic: false } : m))
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message'
      setSendError(msg)
      // Mark as failed (don't permanently leave a fake message)
      setMessages(prev =>
        prev.map(m => (m.id === tempId ? { ...m, optimistic: false, failed: true } : m))
      )
      seenIds.current.delete(tempId)
    } finally {
      setIsSending(false)
    }
  }, [currentUserId, currentUserSender])

  // ── Edit a message ──────────────────────────────────────────────────────────
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    const trimmed = newContent.trim()
    const previous = messages.find(m => m.id === messageId)

    // Optimistic update
    setMessages(prev =>
      prev.map(m => (m.id === messageId ? { ...m, content: trimmed, edited_at: new Date().toISOString() } : m))
    )

    try {
      const res = await fetch(`/api/hub/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Failed to edit message')
      }
      const { message: updated }: { message: { id: string; content: string; edited_at: string | null } } = await res.json()
      setMessages(prev =>
        prev.map(m => (m.id === updated.id ? { ...m, content: updated.content, edited_at: updated.edited_at } : m))
      )
    } catch (err: unknown) {
      // Revert on failure
      if (previous) {
        setMessages(prev => prev.map(m => (m.id === messageId ? previous : m)))
      }
      const msg = err instanceof Error ? err.message : 'Failed to edit message'
      setSendError(msg)
    }
  }, [messages])

  // ── Delete a message ────────────────────────────────────────────────────────
  const deleteMessage = useCallback(async (messageId: string) => {
    // Optimistically remove from UI
    setMessages(prev => prev.filter(m => m.id !== messageId))
    seenIds.current.delete(messageId)

    try {
      const res = await fetch(`/api/hub/messages/${messageId}`, { method: 'DELETE' })
      if (!res.ok) {
        throw new Error('Delete failed')
      }
    } catch (err) {
      console.error('[Hub] Delete failed:', err)
      // The realtime DELETE event will NOT fire if we deleted it ourselves
      // and the DB delete actually failed, so we do nothing to restore here —
      // the user can refresh. A full undo would need the snapshot.
    }
  }, [])

  return {
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
  }
}
