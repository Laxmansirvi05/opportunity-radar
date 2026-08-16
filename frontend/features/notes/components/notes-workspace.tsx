'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useClientNow } from '@/hooks/use-client-now'
import { FolderCard3D } from './folder-card-3d'
import { NoteCard } from './note-card'
import { NoteEditorPane } from './note-editor-pane'
import { FolderDialog } from './folder-dialog'
import { AttachmentsView } from './attachments-view'
import {
  bulkNoteAction, createFolder, deleteFolder, deleteNote, duplicateNote, emptyTrash,
  listFolders, listNotes, reorderFolders, restoreNote, updateFolder, updateNote,
} from '../services/notes-client'
import { NOTE_TEMPLATES } from '../lib/note-templates'
import type { CreateFolderInput, Note, NoteFolder, NoteSort, NoteView } from '../types'
import { paletteFor } from '../lib/folder-colors'

interface NotesWorkspaceProps {
  initialNotes: Note[]
  initialFolders: NoteFolder[]
}

const VIEWS: { value: NoteView; label: string; icon: string }[] = [
  { value: 'all', label: 'All Notes', icon: 'description' },
  { value: 'recent', label: 'Recent', icon: 'schedule' },
  { value: 'pinned', label: 'Pinned', icon: 'push_pin' },
  { value: 'shared', label: 'Shared', icon: 'group' },
  { value: 'attachments', label: 'Attachments', icon: 'attach_file' },
  { value: 'archived', label: 'Archive', icon: 'archive' },
  { value: 'trash', label: 'Trash', icon: 'delete' },
]

const SORTS: { value: NoteSort; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'created', label: 'Recently created' },
  { value: 'alphabetical', label: 'Alphabetical' },
]

const SEARCH_DEBOUNCE_MS = 300

type ContextTarget =
  | { kind: 'folder'; folder: NoteFolder; x: number; y: number }
  | { kind: 'note'; note: Note; x: number; y: number }

/**
 * The Notes workspace: sidebar, folder browser, note list, editor.
 *
 * All four are one client component because they share a single source of
 * truth for the current view, selection and folder list — splitting them
 * would mean either prop-drilling every mutation or a second state system
 * that can disagree with this one.
 */
export function NotesWorkspace({ initialNotes, initialFolders }: NotesWorkspaceProps) {
  const [notes, setNotes] = useState(initialNotes)
  const [folders, setFolders] = useState(initialFolders)
  const [view, setView] = useState<NoteView>('all')
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<NoteSort>('updated')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{ note: Note | null; draft?: { title: string; content: string } } | null>(null)
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false)
  // Index of the folder currently being dragged in the sidebar, and the one it
  // is hovering over — both null when no drag is in progress.
  const [dragFolderId, setDragFolderId] = useState<string | null>(null)
  const [dropFolderId, setDropFolderId] = useState<string | null>(null)
  const [contextTarget, setContextTarget] = useState<ContextTarget | null>(null)
  const [folderDialog, setFolderDialog] = useState<{ folder: NoteFolder | null } | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const now = useClientNow()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)

  const activeFolder = useMemo(
    () => folders.find((folder) => folder.id === activeFolderId) ?? null,
    [activeFolderId, folders]
  )

  const refreshFolders = useCallback(async () => {
    try {
      setFolders(await listFolders())
    } catch {
      // A stale folder list is survivable; the notes themselves still load.
    }
  }, [])

  const fetchNotes = useCallback(async () => {
    setIsLoading(true)
    try {
      setNotes(await listNotes({
        q: query || undefined,
        view,
        sort,
        folderId: activeFolderId ?? undefined,
      }))
    } catch {
      toast.error('Could not load notes.')
    } finally {
      setIsLoading(false)
    }
  }, [activeFolderId, query, sort, view])

  useEffect(() => {
    // The server already fetched the default view, so the first render must
    // not immediately refetch identical parameters.
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fetchNotes, SEARCH_DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [fetchNotes])

  useEffect(() => {
    if (!contextTarget) return
    const dismiss = () => setContextTarget(null)
    window.addEventListener('pointerdown', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [contextTarget])

  const selectView = useCallback((next: NoteView) => {
    setView(next)
    setActiveFolderId(null)
    setSelectedIds(new Set())
    setIsSidebarOpen(false)
  }, [])

  const openFolder = useCallback((folder: NoteFolder) => {
    setActiveFolderId(folder.id)
    setView('all')
    setSelectedIds(new Set())
    setIsSidebarOpen(false)
  }, [])

  const upsertNote = useCallback((note: Note) => {
    setNotes((prev) => {
      const exists = prev.some((item) => item.id === note.id)
      return exists ? prev.map((item) => (item.id === note.id ? note : item)) : [note, ...prev]
    })
    void refreshFolders()
  }, [refreshFolders])

  const dropNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id))
    void refreshFolders()
  }, [refreshFolders])

  const toggleSelect = useCallback((note: Note) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(note.id)) next.delete(note.id)
      else next.add(note.id)
      return next
    })
  }, [])

  const runBulk = useCallback(
    async (action: Parameters<typeof bulkNoteAction>[1], folderId?: string | null) => {
      const ids = [...selectedIds]
      if (ids.length === 0) return
      try {
        await bulkNoteAction(ids, action, folderId)
        setSelectedIds(new Set())
        await fetchNotes()
        await refreshFolders()
        toast.success(`${ids.length} ${ids.length === 1 ? 'note' : 'notes'} updated`)
      } catch {
        toast.error('Could not update the selected notes.')
      }
    },
    [fetchNotes, refreshFolders, selectedIds]
  )

  const noteAction = useCallback(
    async (action: 'pin' | 'archive' | 'duplicate' | 'trash' | 'move' | 'restore' | 'delete', note: Note) => {
      try {
        if (action === 'pin') {
          upsertNote((await updateNote(note.id, { is_pinned: !note.is_pinned }))!)
        } else if (action === 'archive') {
          await updateNote(note.id, { is_archived: !note.is_archived })
          dropNote(note.id)
          toast.success(note.is_archived ? 'Note unarchived' : 'Note archived')
        } else if (action === 'duplicate') {
          upsertNote(await duplicateNote(note.id))
          toast.success('Note duplicated')
        } else if (action === 'trash') {
          await deleteNote(note.id)
          dropNote(note.id)
          setEditing(null)
          toast.success('Moved to Trash')
        } else if (action === 'restore') {
          await restoreNote(note.id)
          dropNote(note.id)
          toast.success('Note restored')
        } else if (action === 'delete') {
          await deleteNote(note.id, true)
          dropNote(note.id)
          toast.success('Note deleted permanently')
        } else if (action === 'move') {
          setSelectedIds(new Set([note.id]))
        }
      } catch {
        toast.error('That action did not work. Please try again.')
      }
    },
    [dropNote, upsertNote]
  )

  const saveFolder = useCallback(
    async (input: CreateFolderInput, existing: NoteFolder | null) => {
      try {
        if (existing) {
          await updateFolder(existing.id, input)
          toast.success('Folder updated')
        } else {
          await createFolder(input)
          toast.success('Folder created')
        }
        setFolderDialog(null)
        await refreshFolders()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not save the folder.')
      }
    },
    [refreshFolders]
  )

  /**
   * Commits a sidebar drag as one reorder request.
   *
   * The whole list is renumbered and sent together rather than PATCHing the
   * dragged folder alone: moving one folder shifts every folder after it, and
   * separate requests for each can land out of order.
   */
  const commitFolderDrop = useCallback(
    async (targetId: string) => {
      const sourceId = dragFolderId
      setDragFolderId(null)
      setDropFolderId(null)
      if (!sourceId || sourceId === targetId) return

      const current = [...folders]
      const from = current.findIndex((folder) => folder.id === sourceId)
      const to = current.findIndex((folder) => folder.id === targetId)
      if (from < 0 || to < 0) return

      const [moved] = current.splice(from, 1)
      current.splice(to, 0, moved)
      // Optimistic: the sidebar reorders on drop, and a failed request simply
      // reloads the server's own order over the top of it.
      setFolders(current.map((folder, index) => ({ ...folder, position: index })))

      try {
        await reorderFolders(current.map((folder, index) => ({ id: folder.id, position: index })))
      } catch {
        toast.error('Could not save the new folder order.')
        await refreshFolders()
      }
    },
    [dragFolderId, folders, refreshFolders]
  )

  const removeFolder = useCallback(
    async (folder: NoteFolder) => {
      try {
        await deleteFolder(folder.id)
        if (activeFolderId === folder.id) setActiveFolderId(null)
        await refreshFolders()
        await fetchNotes()
        toast.success(`"${folder.name}" deleted. Its notes moved to Unfiled.`)
      } catch {
        toast.error('Could not delete the folder.')
      }
    },
    [activeFolderId, fetchNotes, refreshFolders]
  )

  const showFolderBrowser = view === 'all' && !activeFolderId && !query.trim()
  const rootFolders = folders.filter((folder) => !folder.parent_id)
  const heading = activeFolder?.name ?? VIEWS.find((item) => item.value === view)?.label ?? 'Notes'

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-1rem)] min-h-0 -m-4 sm:-m-6">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 shrink-0 flex-col border-r border-outline-variant bg-surface-container-low overflow-y-auto transition-transform duration-300 ease-note md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0 flex' : '-translate-x-full hidden md:flex'
        }`}
        aria-label="Notes navigation"
      >
        <div className="p-3">
          <button
            type="button"
            onClick={() => setEditing({ note: null })}
            className="w-full h-10 rounded-full bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Note
          </button>
        </div>

        <nav className="px-2 pb-2">
          {VIEWS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => selectView(item.value)}
              aria-current={view === item.value && !activeFolderId ? 'page' : undefined}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left cursor-pointer transition-colors font-label-md text-label-md ${
                view === item.value && !activeFolderId
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-4 pt-2 pb-1 flex items-center justify-between">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">Folders</span>
          <button
            type="button"
            aria-label="New folder"
            onClick={() => setFolderDialog({ folder: null })}
            className="h-6 w-6 grid place-items-center rounded-full text-on-surface-variant hover:bg-surface-container cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>
        </div>

        <nav className="px-2 pb-4">
          {folders.map((folder) => {
            const palette = paletteFor(folder.color)
            return (
              <button
                key={folder.id}
                type="button"
                draggable
                onDragStart={() => setDragFolderId(folder.id)}
                onDragOver={(event) => { event.preventDefault(); setDropFolderId(folder.id) }}
                onDragLeave={() => setDropFolderId((id) => (id === folder.id ? null : id))}
                onDrop={(event) => { event.preventDefault(); void commitFolderDrop(folder.id) }}
                onDragEnd={() => { setDragFolderId(null); setDropFolderId(null) }}
                onClick={() => openFolder(folder)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  setContextTarget({ kind: 'folder', folder, x: event.clientX, y: event.clientY })
                }}
                aria-current={activeFolderId === folder.id ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left cursor-pointer transition-colors font-label-md text-label-md ${
                  activeFolderId === folder.id
                    ? 'bg-primary-container text-on-primary-container'
                    : 'text-on-surface-variant hover:bg-surface-container'
                } ${folder.parent_id ? 'pl-6' : ''} ${
                  dragFolderId === folder.id ? 'opacity-40' : ''
                } ${dropFolderId === folder.id && dragFolderId !== folder.id ? 'ring-2 ring-primary' : ''}`}
              >
                <span className="material-symbols-outlined text-[18px]" style={{ color: palette.tab }}>
                  {folder.icon || 'folder'}
                </span>
                <span className="truncate flex-1">{folder.name}</span>
                <span className="font-label-sm text-label-sm tabular-nums opacity-70">{folder.note_count}</span>
              </button>
            )
          })}
          {folders.length === 0 && (
            <p className="px-2.5 py-2 font-body-sm text-body-sm text-on-surface-variant">No folders yet.</p>
          )}
        </nav>
      </aside>

      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-scrim/40 md:hidden cursor-default"
        />
      )}

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col min-h-0">
        {editing ? (
          <NoteEditorPane
            note={editing.note}
            draft={editing.draft}
            folderId={activeFolderId}
            onClose={() => { setEditing(null); void fetchNotes(); void refreshFolders() }}
            onSaved={upsertNote}
            onDeleted={dropNote}
            onAction={noteAction}
          />
        ) : (
          <>
            <header className="px-4 sm:px-6 pt-4 pb-3 border-b border-outline-variant shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  aria-label="Open notes navigation"
                  onClick={() => setIsSidebarOpen(true)}
                  className="md:hidden h-9 w-9 grid place-items-center rounded-full text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">menu</span>
                </button>

                {activeFolderId && (
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(null)}
                    className="h-9 px-2.5 rounded-full flex items-center gap-1 text-on-surface-variant hover:bg-surface-container cursor-pointer font-label-md text-label-md"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    All Notes
                  </button>
                )}

                <h1 className="font-headline-sm text-headline-sm text-on-surface truncate flex-1">{heading}</h1>

                <button
                  type="button"
                  aria-label={layout === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
                  onClick={() => setLayout((value) => (value === 'grid' ? 'list' : 'grid'))}
                  className="h-9 w-9 grid place-items-center rounded-full text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">{layout === 'grid' ? 'view_list' : 'grid_view'}</span>
                </button>

                <div className="flex items-center rounded-full bg-primary text-on-primary">
                  <button
                    type="button"
                    onClick={() => setEditing({ note: null })}
                    className="h-9 pl-3.5 pr-2.5 rounded-l-full font-label-md text-label-md flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span className="hidden sm:inline">New Note</span>
                  </button>
                  <span aria-hidden="true" className="h-5 w-px bg-on-primary/30" />
                  <div className="relative">
                    <button
                      type="button"
                      aria-label="Start from a template"
                      aria-expanded={isTemplateMenuOpen}
                      aria-haspopup="menu"
                      onClick={() => setIsTemplateMenuOpen((open) => !open)}
                      className="h-9 px-2 rounded-r-full grid place-items-center cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[18px]">expand_more</span>
                    </button>

                    {isTemplateMenuOpen && (
                      <>
                        <button
                          type="button"
                          aria-label="Close templates"
                          onClick={() => setIsTemplateMenuOpen(false)}
                          className="fixed inset-0 z-40 cursor-default"
                        />
                        <div role="menu" className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl bg-surface-container-high border border-outline-variant shadow-2xl py-1">
                          <p className="px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant">Start from a template</p>
                          {NOTE_TEMPLATES.map((template) => (
                            <button
                              key={template.id}
                              type="button"
                              role="menuitem"
                              aria-label={`New note from the ${template.name} template`}
                              onClick={() => {
                                setIsTemplateMenuOpen(false)
                                setEditing({ note: null, draft: { title: template.title, content: template.content } })
                              }}
                              className="w-full flex items-start gap-2.5 px-3 py-2 text-left cursor-pointer text-on-surface hover:bg-surface-container transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px] text-on-surface-variant mt-0.5">{template.icon}</span>
                              <span className="min-w-0">
                                <span className="block font-label-md text-label-md">{template.name}</span>
                                <span className="block font-body-sm text-body-sm text-on-surface-variant">{template.description}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[12rem] h-10 px-3.5 rounded-full bg-surface-container border border-outline-variant focus-within:border-primary transition-colors">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">search</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={activeFolder ? `Search in ${activeFolder.name}…` : 'Search notes…'}
                    aria-label="Search notes"
                    className="flex-1 bg-transparent outline-none font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant"
                  />
                </div>

                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as NoteSort)}
                  aria-label="Sort notes"
                  className="h-10 px-3 rounded-full bg-surface-container border border-outline-variant font-label-md text-label-md text-on-surface cursor-pointer outline-none"
                >
                  {SORTS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                {view === 'trash' && notes.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const count = await emptyTrash()
                        await fetchNotes()
                        toast.success(`${count} ${count === 1 ? 'note' : 'notes'} deleted permanently`)
                      } catch {
                        toast.error('Could not empty the Trash.')
                      }
                    }}
                    className="h-10 px-3.5 rounded-full border border-error text-error font-label-md text-label-md cursor-pointer hover:bg-error-container hover:text-on-error-container transition-colors"
                  >
                    Empty Trash
                  </button>
                )}
              </div>
            </header>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-primary-container text-on-primary-container shrink-0 flex-wrap">
                <span className="font-label-md text-label-md">{selectedIds.size} selected</span>
                <div className="flex-1" />
                {view === 'trash' ? (
                  <>
                    <BulkButton icon="restore_from_trash" label="Restore" onClick={() => runBulk('restore')} />
                    <BulkButton icon="delete_forever" label="Delete" onClick={() => runBulk('delete')} />
                  </>
                ) : (
                  <>
                    <BulkButton icon="push_pin" label="Pin" onClick={() => runBulk('pin')} />
                    <BulkButton icon="archive" label="Archive" onClick={() => runBulk('archive')} />
                    <select
                      aria-label="Move selected notes to folder"
                      defaultValue=""
                      onChange={(event) => {
                        const value = event.target.value
                        event.target.value = ''
                        void runBulk('move', value === 'unfiled' ? null : value)
                      }}
                      className="h-8 px-2 rounded-full bg-surface text-on-surface font-label-md text-label-md cursor-pointer outline-none"
                    >
                      <option value="" disabled>Move to…</option>
                      <option value="unfiled">Unfiled</option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>{folder.name}</option>
                      ))}
                    </select>
                    <BulkButton icon="delete" label="Trash" onClick={() => runBulk('trash')} />
                  </>
                )}
                <BulkButton icon="close" label="Clear" onClick={() => setSelectedIds(new Set())} />
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">
              {view === 'attachments' ? (
                <AttachmentsView onOpenNote={(id) => {
                  const target = notes.find((note) => note.id === id)
                  if (target) setEditing({ note: target })
                }} />
              ) : showFolderBrowser ? (
                <>
                  {rootFolders.length > 0 ? (
                    <div className="note-folder-grid grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 mb-8">
                      {rootFolders.map((folder) => (
                        <FolderCard3D
                          key={folder.id}
                          folder={folder}
                          onOpen={openFolder}
                          onContextMenu={(target, position) =>
                            setContextTarget({ kind: 'folder', folder: target, x: position.x, y: position.y })}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon="folder"
                      title="Organise your notes"
                      body="Create your first folder to group interview prep, opportunity research, and everything else."
                      actionLabel="New Folder"
                      onAction={() => setFolderDialog({ folder: null })}
                    />
                  )}

                  <NoteList
                    notes={notes}
                    layout={layout}
                    now={now}
                    isLoading={isLoading}
                    selectedIds={selectedIds}
                    heading={rootFolders.length > 0 ? 'All notes' : undefined}
                    onOpen={(note) => setEditing({ note })}
                    onToggleSelect={toggleSelect}
                    onContextMenu={(note, position) =>
                      setContextTarget({ kind: 'note', note, x: position.x, y: position.y })}
                    empty={
                      <EmptyState
                        icon="note_stack"
                        title="Create your first note"
                        body="Capture ideas, interview preparation, opportunity research, and more."
                        actionLabel="New Note"
                        onAction={() => setEditing({ note: null })}
                      />
                    }
                  />
                </>
              ) : (
                <NoteList
                  notes={notes}
                  layout={layout}
                  now={now}
                  isLoading={isLoading}
                  selectedIds={selectedIds}
                  onOpen={(note) => setEditing({ note })}
                  onToggleSelect={toggleSelect}
                  onContextMenu={(note, position) =>
                    setContextTarget({ kind: 'note', note, x: position.x, y: position.y })}
                  empty={
                    query.trim() ? (
                      <EmptyState icon="search_off" title="No notes found" body="Try another search." />
                    ) : view === 'trash' ? (
                      <EmptyState icon="delete" title="Trash is empty" body="Deleted notes wait here before they're gone for good." />
                    ) : view === 'shared' ? (
                      <EmptyState icon="group" title="Nothing shared with you" body="Notes other people share will appear here." />
                    ) : view === 'archived' ? (
                      <EmptyState icon="archive" title="Nothing archived" body="Archived notes are hidden from your other views." />
                    ) : (
                      <EmptyState
                        icon="note_stack"
                        title={activeFolder ? `"${activeFolder.name}" is empty` : 'Create your first note'}
                        body="Capture ideas, interview preparation, opportunity research, and more."
                        actionLabel="New Note"
                        onAction={() => setEditing({ note: null })}
                      />
                    )
                  }
                />
              )}
            </div>
          </>
        )}
      </main>

      {/* ── Context menu ────────────────────────────────────────────────── */}
      {contextTarget && (
        <div
          role="menu"
          style={{ top: Math.min(contextTarget.y, window.innerHeight - 280), left: Math.min(contextTarget.x, window.innerWidth - 220) }}
          className="fixed z-50 w-52 rounded-xl bg-surface-container-high border border-outline-variant shadow-2xl py-1"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {contextTarget.kind === 'folder' ? (
            <>
              <MenuItem icon="folder_open" label="Open" onClick={() => { openFolder(contextTarget.folder); setContextTarget(null) }} />
              <MenuItem icon="edit" label="Rename & colour" onClick={() => { setFolderDialog({ folder: contextTarget.folder }); setContextTarget(null) }} />
              <MenuItem icon="note_add" label="New note here" onClick={() => { setActiveFolderId(contextTarget.folder.id); setEditing({ note: null }); setContextTarget(null) }} />
              <MenuItem icon="create_new_folder" label="New subfolder" onClick={() => { setFolderDialog({ folder: null }); setContextTarget(null) }} />
              <div className="h-px bg-outline-variant my-1" />
              <MenuItem icon="delete" label="Delete folder" destructive onClick={() => { void removeFolder(contextTarget.folder); setContextTarget(null) }} />
            </>
          ) : view === 'trash' ? (
            <>
              <MenuItem icon="restore_from_trash" label="Restore" onClick={() => { void noteAction('restore', contextTarget.note); setContextTarget(null) }} />
              <div className="h-px bg-outline-variant my-1" />
              <MenuItem icon="delete_forever" label="Delete permanently" destructive onClick={() => { void noteAction('delete', contextTarget.note); setContextTarget(null) }} />
            </>
          ) : (
            <>
              <MenuItem icon="open_in_new" label="Open" onClick={() => { setEditing({ note: contextTarget.note }); setContextTarget(null) }} />
              <MenuItem icon="push_pin" label={contextTarget.note.is_pinned ? 'Unpin' : 'Pin'} onClick={() => { void noteAction('pin', contextTarget.note); setContextTarget(null) }} />
              <MenuItem icon="content_copy" label="Duplicate" onClick={() => { void noteAction('duplicate', contextTarget.note); setContextTarget(null) }} />
              <MenuItem icon="archive" label={contextTarget.note.is_archived ? 'Unarchive' : 'Archive'} onClick={() => { void noteAction('archive', contextTarget.note); setContextTarget(null) }} />
              <div className="h-px bg-outline-variant my-1" />
              <MenuItem icon="delete" label="Move to Trash" destructive onClick={() => { void noteAction('trash', contextTarget.note); setContextTarget(null) }} />
            </>
          )}
        </div>
      )}

      {folderDialog && (
        <FolderDialog
          folder={folderDialog.folder}
          folders={folders}
          onClose={() => setFolderDialog(null)}
          onSave={(input) => saveFolder(input, folderDialog.folder)}
        />
      )}
    </div>
  )
}

function BulkButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 px-2.5 rounded-full flex items-center gap-1 cursor-pointer hover:bg-on-primary-container/10 transition-colors font-label-md text-label-md"
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
      {label}
    </button>
  )
}

function MenuItem({ icon, label, destructive, onClick }: { icon: string; label: string; destructive?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer font-label-md text-label-md transition-colors ${
        destructive ? 'text-error hover:bg-error-container' : 'text-on-surface hover:bg-surface-container'
      }`}
    >
      <span className={`material-symbols-outlined text-[18px] ${destructive ? '' : 'text-on-surface-variant'}`}>{icon}</span>
      {label}
    </button>
  )
}

function NoteList({
  notes, layout, now, isLoading, selectedIds, heading, empty, onOpen, onToggleSelect, onContextMenu,
}: {
  notes: Note[]
  layout: 'grid' | 'list'
  now: number | null
  isLoading: boolean
  selectedIds: Set<string>
  heading?: string
  empty: React.ReactNode
  onOpen: (note: Note) => void
  onToggleSelect: (note: Note, additive: boolean) => void
  onContextMenu: (note: Note, position: { x: number; y: number }) => void
}) {
  if (isLoading && notes.length === 0) {
    return <p className="py-10 text-center font-body-md text-body-md text-on-surface-variant">Loading notes…</p>
  }
  if (notes.length === 0) return <>{empty}</>

  return (
    <section>
      {heading && <h2 className="font-title-sm text-title-sm text-on-surface-variant mb-3">{heading}</h2>}
      <div className={layout === 'grid' ? 'grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'flex flex-col gap-2'}>
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            layout={layout}
            now={now}
            selected={selectedIds.has(note.id)}
            selectionMode={selectedIds.size > 0}
            onOpen={onOpen}
            onToggleSelect={onToggleSelect}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
    </section>
  )
}

function EmptyState({
  icon, title, body, actionLabel, onAction,
}: {
  icon: string
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-outline-variant py-12 px-6">
      <span className="material-symbols-outlined text-[32px] text-on-surface-variant mb-2">{icon}</span>
      <h2 className="font-title-md text-title-md text-on-surface">{title}</h2>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-sm mt-1">{body}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 h-10 px-4 rounded-full bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
