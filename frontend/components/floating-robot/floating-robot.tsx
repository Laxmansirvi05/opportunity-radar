'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRobotPosition } from './use-robot-position'
import { useRobotDrag } from './use-robot-drag'
import { RobotErrorBoundary } from './robot-error-boundary'
import { RobotFallback } from './robot-fallback'
import { QuickNoteComposer } from './quick-note-composer'

// 25% larger than the original 110. useRobotPosition clamps against this
// value, so a stored position from the smaller robot is pulled back inside
// the viewport on the next mount rather than leaving it half off-screen.
const ROBOT_SIZE = 138
const LOAD_TIMEOUT_MS = 8000

const RobotSceneInner = dynamic(() => import('./robot-scene-inner'), {
  ssr: false,
  loading: () => <RobotFallback />,
})

/**
 * Detects opportunity/application context purely from the current route —
 * no cross-tree context provider needed, since this component is mounted
 * at the layout level and /opportunities/[id] already carries the id in
 * its URL. Only attaches application_id when the signed-in user already
 * has an application_tracker row for that opportunity; never fabricates one.
 */
function useOpportunityContext() {
  const pathname = usePathname()
  // Derived straight from the route during render — no effect needed for
  // this half, since pathname is already reactive on its own.
  const opportunityId = useMemo(() => {
    const match = pathname.match(/^\/opportunities\/([^/]+)/)
    return match ? match[1] : null
  }, [pathname])

  // Only the async lookup (does this user already track this opportunity)
  // needs an effect — it's a real fetch from an external system, not a
  // pure derivation of already-available render state.
  const [applicationId, setApplicationId] = useState<string | null>(null)

  useEffect(() => {
    if (!opportunityId) return
    let cancelled = false

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return
      supabase
        .from('application_tracker')
        .select('id')
        .eq('user_id', user.id)
        .eq('opportunity_id', opportunityId)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled && data) setApplicationId(data.id)
        })
    })

    return () => {
      cancelled = true
    }
  }, [opportunityId])

  // applicationId resets to null the instant opportunityId changes (a new
  // route) rather than briefly showing the previous page's stale id.
  return { opportunityId, applicationId: opportunityId ? applicationId : null }
}

export function FloatingRobot() {
  const { position, setPosition } = useRobotPosition(ROBOT_SIZE)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [sceneFailed, setSceneFailed] = useState(false)
  // A ref, not state: this only gates a timeout callback's internal
  // decision (has the real onLoad already fired?), never rendered directly.
  const sceneLoadedRef = useRef(false)
  const activationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const context = useOpportunityContext()

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!sceneLoadedRef.current) setSceneFailed(true)
    }, LOAD_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    return () => {
      if (activationTimerRef.current) clearTimeout(activationTimerRef.current)
    }
  }, [])

  const openComposer = useCallback(() => {
    setIsActivating(true)
    if (activationTimerRef.current) clearTimeout(activationTimerRef.current)
    activationTimerRef.current = setTimeout(() => setIsActivating(false), 600)
    setIsComposerOpen(true)
  }, [])

  const { isDragging, handlers } = useRobotDrag({
    position: position ?? { x: 0, y: 0 },
    setPosition,
    elementRef: wrapperRef,
    onTripleTap: openComposer,
    disabled: isComposerOpen,
  })

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !isComposerOpen) {
        e.preventDefault()
        openComposer()
      }
    },
    [isComposerOpen, openComposer]
  )

  if (!position) return null

  return (
    <>
      {/*
        Two elements, deliberately: the outer one owns position (its
        transform is the drag/localStorage-persisted translate(x,y), written
        directly by useRobotDrag during a drag) and must never have anything
        else touch `transform` on it. The inner one owns every visual
        reaction — float, hover scale, drag scale — all of which are also
        `transform`-based. Combining both concerns on one element was tried
        first and is a real bug: a CSS animation targeting `transform`
        (animate-float-y) replaces an element's transform outright rather
        than composing with it, so the position transform was being silently
        discarded the instant the float animation ran — confirmed live via
        getBoundingClientRect() reporting (0, 0) while the inline style
        still correctly said translate(1168px, 716px).
      */}
      <div
        ref={wrapperRef}
        role="button"
        tabIndex={0}
        aria-label="Notes robot — triple-click, triple-tap, or press Enter to add a quick note"
        aria-haspopup="dialog"
        aria-expanded={isComposerOpen}
        onKeyDown={handleKeyDown}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
        {...handlers}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: ROBOT_SIZE,
          height: ROBOT_SIZE,
          transform: `translate(${position.x}px, ${position.y}px)`,
          touchAction: 'none',
        }}
        className="z-[9999] cursor-grab active:cursor-grabbing outline-none rounded-full focus-visible:ring-4 focus-visible:ring-primary/40"
      >
        <div
          className={`relative w-full h-full rounded-full transition-transform duration-200 ${
            isDragging ? 'scale-110 drop-shadow-2xl' : isHovered ? 'scale-105 drop-shadow-xl' : 'drop-shadow-lg'
          } ${!isDragging && !isComposerOpen ? 'animate-float-y' : ''}`}
        >
          {isActivating && (
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-primary/50 animate-pulse-ring pointer-events-none"
            />
          )}
          <RobotErrorBoundary fallback={<RobotFallback />}>
            {sceneFailed ? (
              <RobotFallback />
            ) : (
              <RobotSceneInner onLoad={() => { sceneLoadedRef.current = true }} />
            )}
          </RobotErrorBoundary>
        </div>
      </div>

      {isComposerOpen && (
        <QuickNoteComposer
          anchor={{ x: position.x, y: position.y, size: ROBOT_SIZE }}
          opportunityId={context.opportunityId}
          applicationId={context.applicationId}
          onClose={() => {
            setIsComposerOpen(false)
            // Return focus to the robot rather than dropping it to <body> —
            // a keyboard user who opened the composer with Enter shouldn't
            // lose their place when it closes.
            wrapperRef.current?.focus()
          }}
        />
      )}
    </>
  )
}
