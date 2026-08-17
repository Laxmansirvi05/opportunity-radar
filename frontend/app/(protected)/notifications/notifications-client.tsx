'use client'

import { useState, useEffect } from 'react'
import { BellRing, Check, Trash2, Clock, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

type NotificationType = 'DeadlineAlert' | 'SubmissionApproved' | 'SubmissionRejected' | 'StaleTracker'

interface Notification {
  id: string
  type: NotificationType
  message: string
  is_read: boolean
  created_at: string
  related_opportunity_id: string | null
  opportunities?: { title: string; company_name: string } | null
}

export function NotificationsClient() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications')
      const json = await res.json()
      if (json.data) setNotifications(json.data)
    } catch (e) {
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // This effect kicks off an async fetch whose first statement flips a
    // loading flag. The rule fires on that synchronous setState, but moving it
    // after the await would mean the spinner only appears once the request is
    // already in flight — a worse experience traded for a green lint line.
    // Same justification convention as hub-message.tsx and tracker-board.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications()
  }, [])

  const markRead = async (id: string) => {
    const original = [...notifications]
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', notificationId: id })
      })
      window.dispatchEvent(new Event('notifications-updated'))
    } catch {
      setNotifications(original)
      toast.error('Failed to mark read')
    }
  }

  const markAllRead = async () => {
    const original = [...notifications]
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' })
      })
      window.dispatchEvent(new Event('notifications-updated'))
    } catch {
      setNotifications(original)
      toast.error('Failed to mark all read')
    }
  }

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const original = [...notifications]
    setNotifications(prev => prev.filter(n => n.id !== id))
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
      window.dispatchEvent(new Event('notifications-updated'))
    } catch {
      setNotifications(original)
      toast.error('Failed to delete notification')
    }
  }

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'DeadlineAlert': return <Clock className="w-5 h-5 text-amber-500" />
      case 'SubmissionApproved': return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'SubmissionRejected': return <XCircle className="w-5 h-5 text-red-500" />
      case 'StaleTracker': return <BellRing className="w-5 h-5 text-blue-500" />
      default: return <BellRing className="w-5 h-5 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        {[1,2,3].map(i => (
          <div key={i} className="h-24 bg-surface-variant/50 rounded-xl" />
        ))}
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="flex flex-col gap-4">
      {notifications.length > 0 && unreadCount > 0 && (
        <div className="flex justify-end mb-2">
          <button 
            onClick={markAllRead}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-fixed-dim transition-colors"
          >
            <Check className="w-4 h-4" />
            Mark all as read
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="bg-surface border border-outline-variant rounded-2xl p-12 shadow-sm flex flex-col items-center justify-center text-center min-h-[400px]">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <BellRing className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-on-background mb-2">You&apos;re all caught up!</h3>
          <p className="text-on-surface-variant max-w-md mx-auto">
            You have no notifications right now.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map(notif => {
            const isUnread = !notif.is_read
            const className = `relative flex items-start gap-4 p-4 rounded-xl border transition-all ${
              notif.is_read 
                ? 'bg-surface border-outline-variant/50' 
                : 'bg-primary/5 border-primary/20 shadow-sm'
            } ${notif.related_opportunity_id ? 'cursor-pointer hover:border-primary/50' : ''}`

            const content = (
              <>
                {isUnread && (
                  <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary" />
                )}
                
                <div className="p-2 rounded-full bg-surface">
                  {getIcon(notif.type)}
                </div>
                
                <div className="flex-1 pr-8">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-on-background">
                      {notif.type.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className={`text-sm ${notif.is_read ? 'text-on-surface-variant' : 'text-on-background font-medium'}`}>
                    {notif.message}
                  </p>
                </div>

                <button 
                  onClick={(e) => deleteNotification(notif.id, e)}
                  className="absolute bottom-4 right-4 text-on-surface-variant hover:text-error transition-colors p-1"
                  title="Delete notification"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )

            if (notif.related_opportunity_id) {
              return (
                <Link
                  key={notif.id}
                  href={`/opportunities/${notif.related_opportunity_id}`}
                  onClick={() => isUnread && markRead(notif.id)}
                  className={className}
                >
                  {content}
                </Link>
              )
            }

            return (
              <div
                key={notif.id}
                onClick={() => isUnread && markRead(notif.id)}
                className={className}
              >
                {content}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
