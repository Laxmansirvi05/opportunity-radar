'use client'

import { useState, useMemo, useTransition, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CompanyLogo } from '@/features/opportunities/components/company-logo'
import {
  updateTrackerStatus,
  removeTrackerItem,
  updateTrackerNotes,
} from '../actions/tracker-actions'
import { TRACKER_STAGES, type TrackerStage } from '../stages'
import { computeTrackerStats } from '../stats'

export interface TrackerItem {
  id: string
  status: string
  notes: string | null
  saved_at: string
  applied_at: string | null
  updated_at: string
  opportunity_id: string | null
  title: string
  location: string | null
  mode: string | null
  category: string | null
  deadline: string | null
  salary_range: string | null
  apply_url: string | null
  listing_closed: boolean
  company_name: string
  company_logo: string | null
}

/** Column definitions. `accent` drives the header bar and count chip. */
const COLUMNS: { stage: TrackerStage; label: string; accent: string; dot: string }[] = [
  { stage: 'Saved',               label: 'Saved',        accent: 'bg-outline',      dot: 'bg-outline' },
  { stage: 'Applied',             label: 'Applied',      accent: 'bg-primary',      dot: 'bg-primary' },
  { stage: 'Interview Scheduled', label: 'Interviewing', accent: 'bg-tertiary',     dot: 'bg-tertiary' },
  { stage: 'Selected',            label: 'Offer',        accent: 'bg-secondary',    dot: 'bg-secondary' },
  { stage: 'Rejected',            label: 'Rejected',     accent: 'bg-error',        dot: 'bg-error' },
]

// ── date helpers ────────────────────────────────────────────────────────────

function daysBetween(from: string | null, to: Date): number | null {
  if (!from) return null
  const d = new Date(from)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((to.getTime() - d.getTime()) / 86_400_000)
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** Deadline urgency, or null when there is nothing useful to say. */
function deadlineInfo(deadline: string | null, closed: boolean, now: Date) {
  if (closed) return { text: 'Listing closed', tone: 'bg-error-container text-on-error-container' }
  if (!deadline) return null
  const days = -(daysBetween(deadline, now) ?? 0)
  if (days < 0) return { text: 'Deadline passed', tone: 'bg-error-container text-on-error-container' }
  if (days === 0) return { text: 'Closes today', tone: 'bg-error-container text-on-error-container' }
  if (days <= 3) return { text: `${days}d left`, tone: 'bg-error-container text-on-error-container' }
  if (days <= 14) return { text: `${days}d left`, tone: 'bg-tertiary-container text-on-tertiary-container' }
  return { text: `${days}d left`, tone: 'bg-surface-container text-on-surface-variant' }
}

// `to`/`now` above must always come from here, never a bare `new Date()`
// evaluated inline at render time: the server renders once, the client
// hydrates a moment later, and if those two reads landed in different
// days the badge text (server: "3d left", client: "2d left") wouldn't
// match — a real, live-reproduced React #418 hydration error. Returning
// null until after mount makes the server's render and the client's first
// render identical (no badge yet); the real value fills in a frame later.
function useClientNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null)
  // Same pattern, same reason as hub-message.tsx's timeString fix: this IS
  // the fix for the hydration mismatch above, not the bug this rule
  // normally guards against — there's no server-safe value to compute here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setNow(new Date()), [])
  return now
}

// ── card ────────────────────────────────────────────────────────────────────

function Card({
  item,
  onRemove,
  onOpenNotes,
  dragging = false,
}: {
  item: TrackerItem
  onRemove?: (id: string) => void
  onOpenNotes?: (item: TrackerItem) => void
  dragging?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    disabled: !onRemove, // the overlay copy is not itself draggable
  })

  const now = useClientNow()
  const dl = now ? deadlineInfo(item.deadline, item.listing_closed, now) : null
  const waiting = now && item.status === 'Applied' ? daysBetween(item.applied_at, now) : null

  return (
    <div
      ref={setNodeRef}
      className={`group bg-surface border border-outline-variant rounded-xl p-3.5 shadow-sm flex flex-col gap-2.5 transition-all
        ${isDragging ? 'opacity-30' : 'hover:border-primary/50 hover:shadow-md'}
        ${dragging ? 'rotate-2 shadow-xl border-primary cursor-grabbing' : ''}`}
    >
      <div className="flex items-start gap-2.5">
        {/* Drag handle is its own control so links stay clickable. */}
        <button
          {...attributes}
          {...listeners}
          aria-label={`Move ${item.title}`}
          className="mt-0.5 shrink-0 text-outline hover:text-on-surface-variant cursor-grab active:cursor-grabbing touch-none"
        >
          <span className="material-symbols-outlined text-[18px]">drag_indicator</span>
        </button>

        <CompanyLogo
          src={item.company_logo}
          name={item.company_name}
          alt={`${item.company_name} logo`}
          containerClassName="w-9 h-9 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 border border-outline-variant/50 overflow-hidden"
          imageClassName="w-5 h-5 object-contain"
        />

        <div className="flex flex-col min-w-0 flex-1">
          {item.opportunity_id ? (
            <Link
              href={`/opportunities/${item.opportunity_id}`}
              className="font-bold text-sm text-on-surface hover:text-primary transition-colors line-clamp-2 leading-snug"
            >
              {item.title}
            </Link>
          ) : (
            <span className="font-bold text-sm text-on-surface line-clamp-2">{item.title}</span>
          )}
          <span className="text-xs text-on-surface-variant truncate mt-0.5">{item.company_name}</span>
        </div>
      </div>

      {(dl || item.salary_range || waiting !== null) && (
        <div className="flex flex-wrap items-center gap-1.5 pl-[26px]">
          {dl && (
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${dl.tone}`}>{dl.text}</span>
          )}
          {item.salary_range && (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-surface-container text-on-surface-variant truncate max-w-[130px]">
              {item.salary_range}
            </span>
          )}
          {waiting !== null && waiting >= 0 && (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium text-on-surface-variant">
              {waiting === 0 ? 'Applied today' : `Waiting ${waiting}d`}
            </span>
          )}
        </div>
      )}

      {item.notes && (
        <p className="pl-[26px] text-[11px] text-on-surface-variant italic line-clamp-2">“{item.notes}”</p>
      )}

      <div className="flex items-center justify-between pl-[26px] pt-1.5 border-t border-outline-variant/40">
        <span className="text-[10px] text-on-surface-variant font-medium">
          {formatDate(item.applied_at ?? item.saved_at)}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {item.apply_url && (
            <a
              href={item.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open listing"
              className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-primary"
            >
              <span className="material-symbols-outlined text-[15px]">open_in_new</span>
            </a>
          )}
          <button
            onClick={() => onOpenNotes?.(item)}
            title="Add a note"
            className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-primary cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">edit_note</span>
          </button>
          <button
            onClick={() => onRemove?.(item.id)}
            title="Remove"
            className="p-1 rounded hover:bg-error-container text-on-surface-variant hover:text-on-error-container cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">delete</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── column ──────────────────────────────────────────────────────────────────

function Column({
  stage,
  label,
  accent,
  items,
  onRemove,
  onOpenNotes,
}: {
  stage: TrackerStage
  label: string
  accent: string
  items: TrackerItem[]
  onRemove: (id: string) => void
  onOpenNotes: (item: TrackerItem) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  return (
    <div className="flex flex-col w-full lg:w-[288px] shrink-0 lg:h-full min-h-[220px]">
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${accent}`} />
          <h3 className="font-bold text-[13px] text-on-surface uppercase tracking-wide">{label}</h3>
        </div>
        <span className="bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full text-[11px] font-bold">
          {items.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl p-2 space-y-2.5 overflow-y-auto transition-colors border-2 border-dashed
          ${isOver ? 'border-primary bg-primary/5' : 'border-transparent bg-surface-container-low/40'}`}
      >
        {items.map((item) => (
          <Card key={item.id} item={item} onRemove={onRemove} onOpenNotes={onOpenNotes} />
        ))}

        {items.length === 0 && (
          <div className="h-24 flex flex-col items-center justify-center text-center gap-1 rounded-lg border-2 border-dashed border-outline-variant/60">
            <span className="text-[11px] text-on-surface-variant font-medium">
              {isOver ? 'Drop here' : 'Nothing here yet'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── board ───────────────────────────────────────────────────────────────────

export function TrackerBoard({ initialData }: { initialData: TrackerItem[] }) {
  const [data, setData] = useState<TrackerItem[]>(initialData)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [notesFor, setNotesFor] = useState<TrackerItem | null>(null)
  const [draft, setDraft] = useState('')
  const [, startTransition] = useTransition()

  // Escape closes the notes dialog, matching the certifications panel.
  useEffect(() => {
    if (!notesFor) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNotesFor(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [notesFor])

  const sensors = useSensors(
    // A small distance threshold keeps taps on links and buttons from being
    // swallowed as drags.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

  const byStage = useMemo(() => {
    const map = new Map<string, TrackerItem[]>()
    for (const { stage } of COLUMNS) map.set(stage, [])
    for (const item of data) map.get(item.status)?.push(item)
    return map
  }, [data])

  // Recomputed from `data` on every change (drag, remove, note) — so the
  // header numbers, response rate included, are live, never static.
  const stats = useMemo(() => computeTrackerStats(data), [data])

  const move = useCallback((id: string, next: TrackerStage) => {
    const previous = data
    const item = data.find((d) => d.id === id)
    if (!item || item.status === next) return

    setData((rows) => rows.map((r) => (r.id === id ? { ...r, status: next } : r)))

    startTransition(async () => {
      const res = await updateTrackerStatus(id, next)
      if (!res.success) {
        // Restore the exact prior snapshot rather than the original server
        // payload, so a failure here cannot discard other edits made since load.
        setData(previous)
        toast.error(res.error ?? 'Could not move that application.')
      } else {
        const label = COLUMNS.find((c) => c.stage === next)?.label ?? next
        toast.success(`Moved to ${label}`)
      }
    })
  }, [data])

  const remove = useCallback((id: string) => {
    const previous = data
    setData((rows) => rows.filter((r) => r.id !== id))
    startTransition(async () => {
      const res = await removeTrackerItem(id)
      if (!res.success) {
        setData(previous)
        toast.error(res.error ?? 'Could not remove that application.')
      } else {
        toast.success('Removed from tracker')
      }
    })
  }, [data])

  const saveNotes = useCallback(() => {
    if (!notesFor) return
    const id = notesFor.id
    const text = draft
    const previous = data
    setData((rows) => rows.map((r) => (r.id === id ? { ...r, notes: text } : r)))
    setNotesFor(null)
    startTransition(async () => {
      const res = await updateTrackerNotes(id, text)
      if (!res.success) {
        setData(previous)
        toast.error(res.error ?? 'Could not save your note.')
      }
    })
  }, [notesFor, draft, data])

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const over = e.over?.id
    if (!over) return
    if ((TRACKER_STAGES as readonly string[]).includes(String(over))) {
      move(String(e.active.id), String(over) as TrackerStage)
    }
  }

  const activeItem = activeId ? data.find((d) => d.id === activeId) ?? null : null

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-container-lowest overflow-hidden">
      {/* Header + stats */}
      <div className="px-4 md:px-8 pt-5 pb-4 border-b border-outline-variant bg-surface shrink-0">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-on-background">Application Tracker</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Drag a card between columns to update its stage.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Stat
              label="Tracked"
              value={stats.total}
              hint="Everything on your board, including saved opportunities you haven't applied to yet."
            />
            <Stat
              label="Applications"
              value={stats.applied}
              hint="Opportunities you've applied to — every card that has moved past the Saved column (applied, interviewing, offers and rejections all count)."
            />
            <Stat
              label="Interviewing"
              value={stats.interviewing}
              tone="text-tertiary"
              hint="Applications currently in the interview stage."
            />
            <Stat
              label="Offers"
              value={stats.offers}
              tone="text-secondary"
              hint="Offers received."
            />
            {/* Always shown — a live metric that visibly moves as you drag cards
                past Applied, so it never reads as a static/decorative number.
                "—" until there's at least one application to measure. */}
            <Stat
              label="Response rate"
              value={stats.responseRate === null ? '—' : `${stats.responseRate}%`}
              tone="text-primary"
              hint="Share of your applications that got any employer response — an interview, an offer, or a rejection. Recalculates automatically as you move cards."
            />
          </div>
        </div>
      </div>

      {/* Board */}
      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-[56px] text-outline">assignment</span>
            <h2 className="text-lg font-bold text-on-surface">Nothing tracked yet</h2>
            <p className="text-sm text-on-surface-variant">
              Save an opportunity from Search and it will appear here, ready to move through
              applied, interviewing and offer.
            </p>
            <Link
              href="/search"
              className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Browse opportunities
            </Link>
          </div>
        </div>
      ) : (
        <DndContext
          id="tracker-dnd-context"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="flex-1 overflow-x-auto overflow-y-auto p-4 md:p-6">
            <div className="flex flex-col lg:flex-row gap-4 lg:h-full min-w-fit">
              {COLUMNS.map(({ stage, label, accent }) => (
                <Column
                  key={stage}
                  stage={stage}
                  label={label}
                  accent={accent}
                  items={byStage.get(stage) ?? []}
                  onRemove={remove}
                  onOpenNotes={(item) => { setNotesFor(item); setDraft(item.notes ?? '') }}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeItem ? (
              <div className="w-[272px]">
                <Card item={activeItem} dragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Notes dialog, portalled to <body>.
          Rendered in place it sits inside the board's flex/overflow container,
          and DndContext's transforms make that an ancestor containing block —
          so `fixed inset-0` resolved against the column strip rather than the
          viewport and collapsed the dialog to a sliver. No mount guard is
          needed: it only opens on a click, so it never renders during SSR. */}
      {notesFor && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setNotesFor(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Application note"
        >
          <div
            className="bg-surface w-[calc(100vw-2rem)] sm:w-[480px] max-w-full rounded-2xl shadow-xl p-6 flex flex-col gap-4 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="font-bold text-on-background">Note</h2>
              <p className="text-xs text-on-surface-variant mt-0.5 truncate">{notesFor.title}</p>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              maxLength={2000}
              autoFocus
              placeholder="Recruiter name, interview date, follow-up reminder…"
              className="w-full min-h-[160px] rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNotesFor(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveNotes}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-on-primary hover:opacity-90 cursor-pointer"
              >
                Save note
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'text-on-surface',
  hint,
}: {
  label: string
  value: number | string
  tone?: string
  hint?: string
}) {
  return (
    <div
      title={hint}
      className={`px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/60 min-w-[86px] ${hint ? 'cursor-help' : ''}`}
    >
      <div className={`text-lg font-bold leading-none ${tone}`}>{value}</div>
      <div className="text-[10px] text-on-surface-variant uppercase tracking-wide mt-1 font-semibold">{label}</div>
    </div>
  )
}
