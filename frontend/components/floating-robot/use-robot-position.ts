'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'robot_position_v1'
const EDGE_PADDING = 12

export interface RobotPosition {
  x: number
  y: number
}

function clamp(pos: RobotPosition, size: number): RobotPosition {
  const maxX = window.innerWidth - size - EDGE_PADDING
  const maxY = window.innerHeight - size - EDGE_PADDING
  return {
    x: Math.min(Math.max(pos.x, EDGE_PADDING), Math.max(EDGE_PADDING, maxX)),
    y: Math.min(Math.max(pos.y, EDGE_PADDING), Math.max(EDGE_PADDING, maxY)),
  }
}

function defaultPosition(size: number): RobotPosition {
  return { x: window.innerWidth - size - 24, y: window.innerHeight - size - 96 }
}

function readStoredPosition(): RobotPosition | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed
  } catch {
    // Corrupt/unavailable storage — fall through to the default position.
  }
  return null
}

/**
 * Persists the robot's screen position to localStorage (same client-side
 * persistence convention Hub already uses for its own per-browser
 * preference — `hub_cleared_at_${userId}`), clamped so a window resize
 * (or a position saved on a since-shrunk viewport) never leaves it
 * unreachable off-screen.
 */
export function useRobotPosition(size: number) {
  const [position, setPositionState] = useState<RobotPosition | null>(null)
  const sizeRef = useRef(size)

  useEffect(() => {
    sizeRef.current = size
  }, [size])

  useEffect(() => {
    const stored = readStoredPosition()
    const initial = clamp(stored ?? defaultPosition(sizeRef.current), sizeRef.current)
    setPositionState(initial)

    const handleResize = () => {
      setPositionState((prev) => (prev ? clamp(prev, sizeRef.current) : prev))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const setPosition = useCallback((next: RobotPosition) => {
    const clamped = clamp(next, sizeRef.current)
    setPositionState(clamped)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped))
    } catch {
      // Best-effort — a private-browsing quota error shouldn't break dragging.
    }
  }, [])

  return { position, setPosition }
}
