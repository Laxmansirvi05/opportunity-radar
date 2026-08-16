'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import type { AtsHistoryItem, OptimizerHistoryItem } from '../services/career-insights'

function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function DeleteButton({ onDelete, pending }: { onDelete: () => void; pending: boolean }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <span
        style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
        onClick={(e) => e.preventDefault()}
      >
        <span style={{ fontSize: '11px', color: '#737686' }}>Delete?</span>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete() }}
          disabled={pending}
          style={{ fontSize: '11px', fontWeight: 700, color: '#943700', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
        >
          Yes
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(false) }}
          disabled={pending}
          style={{ fontSize: '11px', fontWeight: 600, color: '#434655', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
        >
          No
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(true) }}
      title="Delete"
      className="material-symbols-outlined"
      style={{
        fontSize: '18px', color: '#a3a6b8', background: 'none', border: 'none', cursor: 'pointer',
        flexShrink: 0, padding: '2px', borderRadius: '4px', lineHeight: 1,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#943700' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#a3a6b8' }}
    >
      delete
    </button>
  )
}

export function AtsHistoryList({ initialItems }: { initialItems: AtsHistoryItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const prev = items
    setItems((cur) => cur.filter((h) => h.id !== id))
    try {
      const res = await fetch(`/api/resume/ats-history/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
    } catch {
      setItems(prev)
      toast.error('Could not delete this ATS check. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  if (items.length === 0) {
    return <p style={{ fontSize: '13px', color: '#737686', margin: 0 }}>No ATS checks yet.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((h) => (
        <Link
          key={h.id}
          href={`/resume/ats?reportId=${h.id}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0',
            textDecoration: 'none', color: 'inherit',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#191b23', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.jobLabel}</p>
            <p style={{ fontSize: '12px', color: '#737686', margin: '2px 0 0 0' }}>{formatHistoryDate(h.createdAt)}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <span style={{
              fontSize: '13px', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px',
              color: h.score >= 65 ? '#006f64' : '#943700',
              backgroundColor: h.score >= 65 ? '#6df5e1' : '#ffdbcd',
            }}>{h.score}</span>
            <DeleteButton onDelete={() => handleDelete(h.id)} pending={deletingId === h.id} />
          </div>
        </Link>
      ))}
    </div>
  )
}

export function OptimizerHistoryList({ initialItems }: { initialItems: OptimizerHistoryItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const prev = items
    setItems((cur) => cur.filter((h) => h.id !== id))
    try {
      const res = await fetch(`/api/resume/optimization/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
    } catch {
      setItems(prev)
      toast.error('Could not delete this optimisation run. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  if (items.length === 0) {
    return <p style={{ fontSize: '13px', color: '#737686', margin: 0 }}>No optimisation runs yet.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((h) => (
        <Link
          key={h.id}
          href={`/resume/copilot?runId=${h.id}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0',
            textDecoration: 'none', color: 'inherit',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#191b23', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {h.targetRole} · {h.companyName}
            </p>
            <p style={{ fontSize: '12px', color: '#737686', margin: '2px 0 0 0' }}>{formatHistoryDate(h.createdAt)}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <span style={{
              fontSize: '13px', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px',
              color: h.baselineScore >= 65 ? '#006f64' : '#943700',
              backgroundColor: h.baselineScore >= 65 ? '#6df5e1' : '#ffdbcd',
            }}>{h.baselineScore}</span>
            <DeleteButton onDelete={() => handleDelete(h.id)} pending={deletingId === h.id} />
          </div>
        </Link>
      ))}
    </div>
  )
}
