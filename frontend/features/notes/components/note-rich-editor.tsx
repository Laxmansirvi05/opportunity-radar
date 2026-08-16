'use client'

import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { buildNoteExtensions } from '../editor/extensions'
import { EditorToolbar, type ToolbarState } from '../editor/editor-toolbar'
import { DrawingDialog } from '../editor/drawing-dialog'
import type { UploadedAttachment } from '../services/notes-client'

interface NoteRichEditorProps {
  content: string
  onChange: (html: string) => void
  onUpload: (file: File) => Promise<UploadedAttachment>
  placeholder?: string
  autoFocus?: boolean
  /** Compact chrome for the robot's Quick Note composer. */
  compact?: boolean
  editable?: boolean
  minHeight?: number
}

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml'
const FILE_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip,application/pdf,text/plain,text/csv,text/markdown,application/zip'

/**
 * The one rich-text editor, shared by the Notes workspace and the robot's
 * Quick Note composer — same principle as the extension set and the notes
 * API: one editing surface, not two that drift apart.
 *
 * Content in and out is a plain HTML string, so nothing upstream (autosave,
 * the API, the read-only shared view) needs to know or care what the editor
 * is built on.
 */
export function NoteRichEditor({
  content, onChange, onUpload, placeholder, autoFocus, compact, editable = true, minHeight,
}: NoteRichEditorProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDrawingOpen, setIsDrawingOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Paste and drop handling is wired once at editor creation (editorProps
  // can't see later renders), so the latest onUpload is read through a ref
  // rather than closed over stale.
  const uploadRef = useRef(onUpload)
  useEffect(() => {
    uploadRef.current = onUpload
  }, [onUpload])

  // handlePaste/handleDrop below are wired before `editor` exists, so they
  // reach the instance through a ref rather than the binding.
  const editorRef = useRef<Editor | null>(null)

  /**
   * Shared by paste and drop: an image becomes an inline image, anything else
   * becomes a file chip. Returns true only when files were actually handled,
   * so ordinary text pasting falls through to tiptap untouched.
   */
  const handleDroppedFiles = useCallback((files: File[], event: Event) => {
    if (files.length === 0) return false
    event.preventDefault()

    setIsUploading(true)
    Promise.all(
      files.map((file) =>
        uploadRef.current(file)
          .then((uploaded) => {
            const instance = editorRef.current
            if (!instance) return
            if (uploaded.kind === 'image') {
              instance.chain().focus().setImage({ src: uploaded.url, alt: uploaded.name }).run()
            } else {
              instance
                .chain()
                .focus()
                .insertFileAttachment({ href: uploaded.url, name: uploaded.name, size: uploaded.size_bytes })
                .run()
            }
          })
          .catch(() => {
            // Nothing was inserted, so there is nothing to roll back. The
            // surrounding surface surfaces upload failures via its own toast.
          })
      )
    ).finally(() => setIsUploading(false))

    return true
  }, [])

  const editor = useEditor({
    extensions: buildNoteExtensions(placeholder),
    content,
    editable,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'note-rich-editor-content outline-none font-body-md text-body-md text-on-surface',
        style: minHeight ? `min-height:${minHeight}px` : 'min-height:120px',
      },
      handlePaste: (_view, event) => handleDroppedFiles(Array.from(event.clipboardData?.files ?? []), event),
      handleDrop: (_view, event) => {
        const dragEvent = event as DragEvent
        return handleDroppedFiles(Array.from(dragEvent.dataTransfer?.files ?? []), dragEvent)
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  })

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    if (!editor || editor.getHTML() === content) return
    editor.commands.setContent(content, { emitUpdate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable)
  }, [editable, editor])

  const state = useEditorState({
    editor,
    selector: (ctx): ToolbarState => ({
      isBold: ctx.editor?.isActive('bold') ?? false,
      isItalic: ctx.editor?.isActive('italic') ?? false,
      isUnderline: ctx.editor?.isActive('underline') ?? false,
      isStrike: ctx.editor?.isActive('strike') ?? false,
      isCode: ctx.editor?.isActive('code') ?? false,
      isCodeBlock: ctx.editor?.isActive('codeBlock') ?? false,
      isHighlight: ctx.editor?.isActive('highlight') ?? false,
      isBlockquote: ctx.editor?.isActive('blockquote') ?? false,
      isLink: ctx.editor?.isActive('link') ?? false,
      isBulletList: ctx.editor?.isActive('bulletList') ?? false,
      isOrderedList: ctx.editor?.isActive('orderedList') ?? false,
      isTaskList: ctx.editor?.isActive('taskList') ?? false,
      isInTable: ctx.editor?.isActive('table') ?? false,
      headingLevel: ctx.editor?.isActive('heading', { level: 1 })
        ? 1
        : ctx.editor?.isActive('heading', { level: 2 })
          ? 2
          : ctx.editor?.isActive('heading', { level: 3 })
            ? 3
            : 0,
      textAlign: ctx.editor?.isActive({ textAlign: 'center' })
        ? 'center'
        : ctx.editor?.isActive({ textAlign: 'right' })
          ? 'right'
          : ctx.editor?.isActive({ textAlign: 'justify' })
            ? 'justify'
            : 'left',
      canUndo: ctx.editor?.can().undo() ?? false,
      canRedo: ctx.editor?.can().redo() ?? false,
    }),
  })

  const uploadAndInsert = useCallback(async (file: File) => {
    if (!editor) return
    setIsUploading(true)
    try {
      const uploaded = await uploadRef.current(file)
      if (uploaded.kind === 'image') {
        editor.chain().focus().setImage({ src: uploaded.url, alt: uploaded.name }).run()
      } else {
        editor
          .chain()
          .focus()
          .insertFileAttachment({ href: uploaded.url, name: uploaded.name, size: uploaded.size_bytes })
          .run()
      }
    } finally {
      setIsUploading(false)
    }
  }, [editor])

  const onFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (file) await uploadAndInsert(file)
    },
    [uploadAndInsert]
  )

  const openLinkEditor = useCallback(() => {
    if (!editor) return
    setLinkDraft((editor.getAttributes('link').href as string) ?? '')
  }, [editor])

  const applyLink = useCallback(() => {
    if (!editor || linkDraft === null) return
    const href = linkDraft.trim()
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      // A bare "example.com" is what people actually type; without this it
      // would be stored as a relative path and silently 404 inside the app.
      const normalised = /^(https?:|mailto:|tel:|\/)/i.test(href) ? href : `https://${href}`
      editor.chain().focus().extendMarkRange('link').setLink({ href: normalised }).run()
    }
    setLinkDraft(null)
  }, [editor, linkDraft])

  if (!editor || !state) return null

  return (
    <div className="flex flex-col gap-2">
      {editable && (
        <EditorToolbar
          editor={editor}
          state={state}
          isUploading={isUploading}
          onInsertImage={() => imageInputRef.current?.click()}
          onInsertFile={() => fileInputRef.current?.click()}
          onOpenDrawing={() => setIsDrawingOpen(true)}
          onSetLink={openLinkEditor}
        />
      )}

      {linkDraft !== null && (
        <div className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-2 py-1.5">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">link</span>
          <input
            autoFocus
            type="url"
            inputMode="url"
            aria-label="Link address"
            placeholder="https://example.com"
            value={linkDraft}
            onChange={(event) => setLinkDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); applyLink() }
              if (event.key === 'Escape') { event.preventDefault(); setLinkDraft(null) }
            }}
            className="flex-1 bg-transparent outline-none font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant"
          />
          <button
            type="button"
            onClick={applyLink}
            className="h-7 px-2.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm cursor-pointer"
          >
            Apply
          </button>
          <button
            type="button"
            aria-label="Cancel link"
            onClick={() => setLinkDraft(null)}
            className="h-7 w-7 grid place-items-center rounded-full text-on-surface-variant hover:bg-surface-container cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      <EditorContent editor={editor} className={compact ? 'note-editor-compact' : undefined} />

      <input ref={imageInputRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={onFileSelected} tabIndex={-1} aria-hidden="true" />
      <input ref={fileInputRef} type="file" accept={FILE_ACCEPT} className="hidden" onChange={onFileSelected} tabIndex={-1} aria-hidden="true" />

      {isDrawingOpen && (
        <DrawingDialog onClose={() => setIsDrawingOpen(false)} onInsert={uploadAndInsert} />
      )}
    </div>
  )
}
