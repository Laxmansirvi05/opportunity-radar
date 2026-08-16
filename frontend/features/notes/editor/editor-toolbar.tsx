'use client'

import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'

interface EditorToolbarProps {
  editor: Editor
  state: ToolbarState
  isUploading: boolean
  onInsertImage: () => void
  onInsertFile: () => void
  onOpenDrawing: () => void
  onSetLink: () => void
}

export interface ToolbarState {
  isBold: boolean
  isItalic: boolean
  isUnderline: boolean
  isStrike: boolean
  isCode: boolean
  isCodeBlock: boolean
  isHighlight: boolean
  isBlockquote: boolean
  isLink: boolean
  isBulletList: boolean
  isOrderedList: boolean
  isTaskList: boolean
  isInTable: boolean
  headingLevel: 0 | 1 | 2 | 3
  textAlign: string
  canUndo: boolean
  canRedo: boolean
}

const TEXT_COLORS = [
  { label: 'Default', value: null },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Green', value: '#059669' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Purple', value: '#7c3aed' },
] as const

const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff'] as const

const FONT_SIZES = [
  { label: 'Small', value: '14px' },
  { label: 'Normal', value: null },
  { label: 'Large', value: '20px' },
  { label: 'Huge', value: '28px' },
] as const

const LINE_HEIGHTS = [
  { label: 'Tight', value: '1.2' },
  { label: 'Normal', value: '1.6' },
  { label: 'Relaxed', value: '2' },
] as const

function ToolbarButton({
  label, icon, active, disabled, onClick,
}: {
  label: string
  icon: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      // The editor loses its selection the moment the button takes focus, so
      // focus is prevented rather than restored afterwards.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-8 w-8 grid place-items-center rounded-lg cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-primary-container text-on-primary-container'
          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
      }`}
    >
      <span className="material-symbols-outlined text-[18px] block">{icon}</span>
    </button>
  )
}

function Divider() {
  return <span aria-hidden="true" className="h-5 w-px bg-outline-variant mx-1 shrink-0" />
}

function MenuRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <span className="font-label-sm text-label-sm text-on-surface-variant w-20 shrink-0">{label}</span>
      <div className="flex items-center gap-0.5 flex-wrap">{children}</div>
    </div>
  )
}

/**
 * The editor's controls: the handful people reach for constantly stay on the
 * bar, everything else lives one click away under More.
 *
 * Deliberately not 25 buttons in a row — a toolbar that fills the screen is
 * the thing that makes a notes app feel like a form rather than a page to
 * write on.
 */
export function EditorToolbar({
  editor, state, isUploading, onInsertImage, onInsertFile, onOpenDrawing, onSetLink,
}: EditorToolbarProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isMoreOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setIsMoreOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMoreOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMoreOpen])

  const chain = () => editor.chain().focus()

  return (
    <div className="flex items-center gap-0.5 flex-wrap py-1.5 px-1 rounded-xl bg-surface-container-low border border-outline-variant sticky top-0 z-20">
      <ToolbarButton label="Undo" icon="undo" disabled={!state.canUndo} onClick={() => chain().undo().run()} />
      <ToolbarButton label="Redo" icon="redo" disabled={!state.canRedo} onClick={() => chain().redo().run()} />

      <Divider />

      <select
        aria-label="Paragraph style"
        value={state.headingLevel}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(event) => {
          const level = Number(event.target.value) as 0 | 1 | 2 | 3
          if (level === 0) chain().setParagraph().run()
          else chain().toggleHeading({ level }).run()
        }}
        className="h-8 rounded-lg px-2 bg-transparent text-on-surface font-label-md text-label-md cursor-pointer hover:bg-surface-container transition-colors border-none outline-none"
      >
        <option value={0}>Body</option>
        <option value={1}>Title</option>
        <option value={2}>Heading</option>
        <option value={3}>Subheading</option>
      </select>

      <Divider />

      <ToolbarButton label="Bold" icon="format_bold" active={state.isBold} onClick={() => chain().toggleBold().run()} />
      <ToolbarButton label="Italic" icon="format_italic" active={state.isItalic} onClick={() => chain().toggleItalic().run()} />
      <ToolbarButton label="Underline" icon="format_underlined" active={state.isUnderline} onClick={() => chain().toggleUnderline().run()} />

      <Divider />

      <ToolbarButton label="Bullet list" icon="format_list_bulleted" active={state.isBulletList} onClick={() => chain().toggleBulletList().run()} />
      <ToolbarButton label="Numbered list" icon="format_list_numbered" active={state.isOrderedList} onClick={() => chain().toggleOrderedList().run()} />
      <ToolbarButton label="Checklist" icon="checklist" active={state.isTaskList} onClick={() => chain().toggleTaskList().run()} />

      <Divider />

      <ToolbarButton label="Link" icon="link" active={state.isLink} onClick={onSetLink} />
      <ToolbarButton label="Insert image" icon="image" disabled={isUploading} onClick={onInsertImage} />
      <ToolbarButton
        label="Insert table"
        icon="table"
        active={state.isInTable}
        onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      />

      <div className="relative" ref={moreRef}>
        <button
          type="button"
          aria-label="More formatting"
          aria-expanded={isMoreOpen}
          aria-haspopup="menu"
          title="More"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsMoreOpen((open) => !open)}
          className={`h-8 px-2 flex items-center gap-1 rounded-lg cursor-pointer transition-colors ${
            isMoreOpen ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">more_horiz</span>
          <span className="font-label-md text-label-md hidden sm:inline">More</span>
        </button>

        {isMoreOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 z-30 w-[19rem] max-h-[70vh] overflow-y-auto rounded-xl bg-surface-container-high border border-outline-variant shadow-2xl py-1.5"
          >
            <MenuRow label="Text">
              <ToolbarButton label="Strikethrough" icon="strikethrough_s" active={state.isStrike} onClick={() => chain().toggleStrike().run()} />
              <ToolbarButton label="Inline code" icon="code" active={state.isCode} onClick={() => chain().toggleCode().run()} />
              <ToolbarButton label="Code block" icon="data_object" active={state.isCodeBlock} onClick={() => chain().toggleCodeBlock().run()} />
              <ToolbarButton label="Quote" icon="format_quote" active={state.isBlockquote} onClick={() => chain().toggleBlockquote().run()} />
              <ToolbarButton label="Divider" icon="horizontal_rule" onClick={() => chain().setHorizontalRule().run()} />
            </MenuRow>

            <MenuRow label="Align">
              <ToolbarButton label="Align left" icon="format_align_left" active={state.textAlign === 'left'} onClick={() => chain().setTextAlign('left').run()} />
              <ToolbarButton label="Align centre" icon="format_align_center" active={state.textAlign === 'center'} onClick={() => chain().setTextAlign('center').run()} />
              <ToolbarButton label="Align right" icon="format_align_right" active={state.textAlign === 'right'} onClick={() => chain().setTextAlign('right').run()} />
              <ToolbarButton label="Justify" icon="format_align_justify" active={state.textAlign === 'justify'} onClick={() => chain().setTextAlign('justify').run()} />
            </MenuRow>

            <MenuRow label="Indent">
              <ToolbarButton
                label="Decrease indent"
                icon="format_indent_decrease"
                onClick={() => chain().liftListItem('listItem').run()}
              />
              <ToolbarButton
                label="Increase indent"
                icon="format_indent_increase"
                onClick={() => chain().sinkListItem('listItem').run()}
              />
            </MenuRow>

            <MenuRow label="Colour">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color.label}
                  type="button"
                  aria-label={`Text colour ${color.label}`}
                  title={color.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => (color.value ? chain().setColor(color.value).run() : chain().unsetColor().run())}
                  className="h-7 w-7 rounded-full border border-outline-variant cursor-pointer grid place-items-center hover:scale-110 transition-transform"
                  style={{ backgroundColor: color.value ?? 'transparent' }}
                >
                  {!color.value && <span className="material-symbols-outlined text-[14px] text-on-surface-variant">format_color_reset</span>}
                </button>
              ))}
            </MenuRow>

            <MenuRow label="Highlight">
              {HIGHLIGHTS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Highlight ${color}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => chain().toggleHighlight({ color }).run()}
                  className="h-7 w-7 rounded-full border border-outline-variant cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                />
              ))}
              <ToolbarButton label="Remove highlight" icon="format_color_reset" active={state.isHighlight} onClick={() => chain().unsetHighlight().run()} />
            </MenuRow>

            <MenuRow label="Size">
              {FONT_SIZES.map((size) => (
                <button
                  key={size.label}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => (size.value ? chain().setFontSize(size.value).run() : chain().unsetFontSize().run())}
                  className="h-7 px-2 rounded-lg cursor-pointer font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                >
                  {size.label}
                </button>
              ))}
            </MenuRow>

            <MenuRow label="Spacing">
              {LINE_HEIGHTS.map((height) => (
                <button
                  key={height.label}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => chain().setLineHeight(height.value).run()}
                  className="h-7 px-2 rounded-lg cursor-pointer font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                >
                  {height.label}
                </button>
              ))}
            </MenuRow>

            {state.isInTable && (
              <MenuRow label="Table">
                <ToolbarButton label="Add row" icon="add_row_below" onClick={() => chain().addRowAfter().run()} />
                <ToolbarButton label="Delete row" icon="delete" onClick={() => chain().deleteRow().run()} />
                <ToolbarButton label="Add column" icon="add_column_right" onClick={() => chain().addColumnAfter().run()} />
                <ToolbarButton label="Delete column" icon="remove_selection" onClick={() => chain().deleteColumn().run()} />
                <ToolbarButton label="Toggle header row" icon="table_rows" onClick={() => chain().toggleHeaderRow().run()} />
                <ToolbarButton label="Delete table" icon="grid_off" onClick={() => chain().deleteTable().run()} />
              </MenuRow>
            )}

            <MenuRow label="Insert">
              <ToolbarButton label="Attach a file" icon="attach_file" disabled={isUploading} onClick={onInsertFile} />
              <ToolbarButton label="Drawing" icon="draw" onClick={onOpenDrawing} />
            </MenuRow>

            <MenuRow label="Clear">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => chain().unsetAllMarks().clearNodes().run()}
                className="h-7 px-2 rounded-lg cursor-pointer font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              >
                Clear formatting
              </button>
            </MenuRow>
          </div>
        )}
      </div>

      {isUploading && (
        <span className="font-label-sm text-label-sm text-on-surface-variant ml-1" aria-live="polite">
          Uploading…
        </span>
      )}
    </div>
  )
}
