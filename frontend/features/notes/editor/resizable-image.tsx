'use client'

import TiptapImage from '@tiptap/extension-image'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { useCallback, useRef, useState } from 'react'

const MIN_WIDTH = 80
const ALIGNMENTS = [
  { value: 'left', icon: 'format_align_left', label: 'Align left' },
  { value: 'center', icon: 'format_align_center', label: 'Align centre' },
  { value: 'right', icon: 'format_align_right', label: 'Align right' },
] as const

/**
 * The image node view: drag-to-resize, alignment, alt text and delete.
 *
 * Width is stored in pixels but rendered with max-width:100%, so an image
 * sized on a desktop still fits a phone instead of forcing the note to scroll
 * sideways. Height is never stored — letting it derive keeps the aspect ratio
 * correct even after the stored width is clamped by a narrower screen.
 */
function ImageNodeView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const width = node.attrs.width as number | null
  const align = (node.attrs['data-align'] as string) ?? 'left'
  const isEditable = editor.isEditable

  const startResize = useCallback(
    (event: React.PointerEvent) => {
      if (!isEditable) return
      event.preventDefault()
      event.stopPropagation()

      const image = containerRef.current?.querySelector('img')
      if (!image) return

      const startX = event.clientX
      const startWidth = image.getBoundingClientRect().width
      // The editor's own content box is the ceiling — an image cannot be
      // resized wider than the column it lives in.
      const maxWidth = containerRef.current?.parentElement?.getBoundingClientRect().width ?? startWidth
      setIsResizing(true)

      const onMove = (moveEvent: PointerEvent) => {
        const next = Math.round(
          Math.min(Math.max(startWidth + (moveEvent.clientX - startX), MIN_WIDTH), maxWidth)
        )
        // Written straight to the DOM during the drag; the transaction is
        // committed once on release, so a resize is one undo step rather than
        // one per pointer event.
        image.style.width = `${next}px`
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        setIsResizing(false)
        const finalWidth = Math.round(image.getBoundingClientRect().width)
        updateAttributes({ width: finalWidth })
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [isEditable, updateAttributes]
  )

  const editAlt = useCallback(() => {
    const next = window.prompt('Describe this image (for screen readers)', (node.attrs.alt as string) ?? '')
    if (next !== null) updateAttributes({ alt: next })
  }, [node.attrs.alt, updateAttributes])

  const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'

  return (
    <NodeViewWrapper
      as="div"
      className="note-image-node my-3"
      style={{ display: 'flex', justifyContent: justify }}
      data-align={align}
    >
      <div
        ref={containerRef}
        className={`relative inline-block max-w-full rounded-xl overflow-hidden ${
          selected ? 'ring-2 ring-primary' : ''
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={node.attrs.src as string}
          alt={(node.attrs.alt as string) ?? ''}
          title={(node.attrs.title as string) ?? undefined}
          style={{ width: width ? `${width}px` : undefined, maxWidth: '100%', height: 'auto', display: 'block' }}
          draggable={false}
        />

        {isEditable && selected && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-lg bg-surface-container-highest/95 backdrop-blur p-0.5 shadow-lg">
            {ALIGNMENTS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={option.label}
                aria-pressed={align === option.value}
                onClick={() => updateAttributes({ 'data-align': option.value })}
                className={`p-1 rounded-md cursor-pointer transition-colors ${
                  align === option.value
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] block">{option.icon}</span>
              </button>
            ))}
            <button
              type="button"
              aria-label="Edit alt text"
              onClick={editAlt}
              className="p-1 rounded-md cursor-pointer text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] block">accessibility_new</span>
            </button>
            <button
              type="button"
              aria-label="Remove image"
              onClick={() => deleteNode()}
              className="p-1 rounded-md cursor-pointer text-error hover:bg-error-container transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] block">delete</span>
            </button>
          </div>
        )}

        {isEditable && (
          <span
            role="presentation"
            onPointerDown={startResize}
            title="Drag to resize"
            className={`absolute bottom-1 right-1 h-4 w-4 rounded-sm border-2 border-surface bg-primary cursor-nwse-resize transition-opacity ${
              selected || isResizing ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </div>
    </NodeViewWrapper>
  )
}

/**
 * Image with persisted width and alignment.
 *
 * Both are real HTML attributes rather than editor-only state, so they
 * survive the round trip through sanitizeNoteContent (which allows exactly
 * these) and render identically in the read-only shared-note view, where no
 * editor exists at all.
 */
export const ResizableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute('width')
          return value ? parseInt(value, 10) : null
        },
        renderHTML: (attributes) => (attributes.width ? { width: attributes.width } : {}),
      },
      'data-align': {
        default: 'left',
        parseHTML: (element) => element.getAttribute('data-align') ?? 'left',
        renderHTML: (attributes) => ({ 'data-align': attributes['data-align'] ?? 'left' }),
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})
