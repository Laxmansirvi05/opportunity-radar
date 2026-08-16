'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const STROKE_WIDTHS = [
  { label: 'Thin', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Thick', value: 8 },
  { label: 'Extra thick', value: 14 },
] as const

const STROKE_COLORS = ['#1f2933', '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'] as const

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 520

interface DrawingDialogProps {
  onClose: () => void
  onInsert: (file: File) => Promise<void> | void
}

/**
 * A lightweight sketch pad, isolated as its own dialog rather than embedded
 * as a live editor block.
 *
 * The output is a flattened PNG uploaded like any other image, which is what
 * keeps this from compromising the rest of the editor: the note's stored
 * content gains one ordinary <img>, so a drawing costs nothing to render, is
 * searchable-around, and works unchanged in the read-only shared view — where
 * no drawing code is loaded at all.
 */
export function DrawingDialog({ onClose, onInsert }: DrawingDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [strokeWidth, setStrokeWidth] = useState<number>(4)
  const [strokeColor, setStrokeColor] = useState<string>(STROKE_COLORS[0])
  const [isEraser, setIsEraser] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    // Painted white rather than left transparent: a transparent PNG of dark
    // ink is invisible against this app's own dark theme.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const pointFrom = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    // The canvas is displayed smaller than its backing resolution, so pointer
    // coordinates have to be scaled or the stroke lands away from the cursor.
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }, [])

  const start = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    lastPointRef.current = pointFrom(event)
  }, [pointFrom])

  const move = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      const last = lastPointRef.current
      if (!canvas || !context || !last) return

      const point = pointFrom(event)
      context.strokeStyle = isEraser ? '#ffffff' : strokeColor
      context.lineWidth = isEraser ? strokeWidth * 3 : strokeWidth
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.beginPath()
      context.moveTo(last.x, last.y)
      context.lineTo(point.x, point.y)
      context.stroke()

      lastPointRef.current = point
      if (isEmpty) setIsEmpty(false)
    },
    [isEmpty, isEraser, pointFrom, strokeColor, strokeWidth]
  )

  const end = useCallback(() => {
    drawingRef.current = false
    lastPointRef.current = null
  }, [])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
  }, [])

  const insert = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || isEmpty) return
    setIsSaving(true)
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) return
      await onInsert(new File([blob], `drawing-${Date.now()}.png`, { type: 'image/png' }))
      onClose()
    } finally {
      setIsSaving(false)
    }
  }, [isEmpty, onClose, onInsert])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Drawing"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-scrim/60 backdrop-blur-sm p-4"
    >
      <button type="button" aria-label="Close drawing" className="absolute inset-0 cursor-default" onClick={onClose} />

      <div className="relative w-full max-w-4xl rounded-2xl bg-surface-container-low shadow-2xl border border-outline-variant overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-outline-variant">
          <span className="font-title-sm text-title-sm text-on-surface mr-2">Drawing</span>

          <div className="flex items-center gap-1" role="group" aria-label="Stroke width">
            {STROKE_WIDTHS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={option.label}
                aria-pressed={!isEraser && strokeWidth === option.value}
                title={option.label}
                onClick={() => { setStrokeWidth(option.value); setIsEraser(false) }}
                className={`h-8 w-8 rounded-lg grid place-items-center cursor-pointer transition-colors ${
                  !isEraser && strokeWidth === option.value
                    ? 'bg-primary-container text-on-primary-container'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span className="rounded-full bg-current block" style={{ width: option.value + 2, height: option.value + 2 }} />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 ml-1" role="group" aria-label="Stroke colour">
            {STROKE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Colour ${color}`}
                aria-pressed={!isEraser && strokeColor === color}
                onClick={() => { setStrokeColor(color); setIsEraser(false) }}
                className={`h-6 w-6 rounded-full cursor-pointer border-2 transition-transform ${
                  !isEraser && strokeColor === color ? 'border-on-surface scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <button
            type="button"
            aria-pressed={isEraser}
            onClick={() => setIsEraser((value) => !value)}
            className={`h-8 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors font-label-md text-label-md ${
              isEraser ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">ink_eraser</span>
            Eraser
          </button>

          <button
            type="button"
            onClick={clear}
            className="h-8 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer text-on-surface-variant hover:bg-surface-container transition-colors font-label-md text-label-md"
          >
            <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            Clear
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 rounded-full cursor-pointer text-on-surface-variant hover:bg-surface-container transition-colors font-label-lg text-label-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={insert}
              disabled={isEmpty || isSaving}
              className="h-9 px-4 rounded-full cursor-pointer bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {isSaving ? 'Inserting…' : 'Insert'}
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="w-full touch-none cursor-crosshair block bg-white"
          style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
        />
      </div>
    </div>
  )
}
