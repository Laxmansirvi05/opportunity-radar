'use client'

import { useEffect, useState } from 'react'
import { FOLDER_COLORS, type CreateFolderInput, type FolderColor, type NoteFolder } from '../types'
import { paletteFor } from '../lib/folder-colors'

interface FolderDialogProps {
  folder: NoteFolder | null
  folders: NoteFolder[]
  onClose: () => void
  onSave: (input: CreateFolderInput) => void
}

/** A small, deliberately short list — an icon picker with 900 options is a menu, not a choice. */
const ICONS = [
  'folder', 'school', 'work', 'code', 'lightbulb', 'science',
  'psychology', 'rocket_launch', 'menu_book', 'groups', 'star', 'flag',
]

/**
 * Create or edit a folder: name, colour, icon, and where it sits.
 *
 * The colour preview is a real folder shape rather than a swatch, because
 * colour here is identity — what the user is choosing is how this folder will
 * be recognised in the browser at a glance.
 */
export function FolderDialog({ folder, folders, onClose, onSave }: FolderDialogProps) {
  const [name, setName] = useState(folder?.name ?? '')
  const [color, setColor] = useState<FolderColor>(folder?.color ?? 'blue')
  const [icon, setIcon] = useState<string>(folder?.icon ?? 'folder')
  const [parentId, setParentId] = useState<string>(folder?.parent_id ?? '')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const palette = paletteFor(color)
  // A folder cannot be its own parent, and offering it as an option would
  // only produce an error the user has to interpret.
  const parentOptions = folders.filter((option) => option.id !== folder?.id)

  return (
    <div role="dialog" aria-modal="true" aria-label={folder ? 'Edit folder' : 'New folder'} className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-scrim/50 backdrop-blur-sm">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) return
          onSave({ name: name.trim(), color, icon, parent_id: parentId || null })
        }}
        className="relative w-full max-w-md rounded-2xl bg-surface-container-low border border-outline-variant shadow-2xl p-5"
      >
        <h2 className="font-title-md text-title-md text-on-surface mb-4">{folder ? 'Edit folder' : 'New folder'}</h2>

        <div className="flex justify-center mb-4" aria-hidden="true">
          <div className="relative" style={{ width: 108, height: 76 }}>
            <div className="absolute inset-x-0 bottom-0 rounded-lg" style={{ height: 62, backgroundColor: palette.back }} />
            <div className="absolute left-2 rounded-t-md" style={{ bottom: 58, width: '42%', height: 10, backgroundColor: palette.tab }} />
            <div
              className="absolute inset-x-0 bottom-0 rounded-lg grid place-items-center"
              style={{ height: 54, background: `linear-gradient(160deg, ${palette.frontFrom} 0%, ${palette.frontTo} 100%)` }}
            >
              <span className="material-symbols-outlined text-[22px]" style={{ color: palette.ink }}>{icon}</span>
            </div>
          </div>
        </div>

        <label className="block mb-3">
          <span className="block font-label-md text-label-md text-on-surface mb-1">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            placeholder="Interview Preparation"
            className="w-full h-10 px-3 rounded-xl bg-surface-container border border-outline-variant font-body-md text-body-md text-on-surface outline-none focus:border-primary"
          />
        </label>

        <fieldset className="mb-3">
          <legend className="font-label-md text-label-md text-on-surface mb-1.5">Colour</legend>
          <div className="flex flex-wrap gap-1.5">
            {FOLDER_COLORS.map((option) => {
              const optionPalette = paletteFor(option)
              return (
                <button
                  key={option}
                  type="button"
                  aria-label={optionPalette.label}
                  aria-pressed={color === option}
                  title={optionPalette.label}
                  onClick={() => setColor(option)}
                  className={`h-8 w-8 rounded-full cursor-pointer border-2 transition-transform ${
                    color === option ? 'border-on-surface scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ background: `linear-gradient(160deg, ${optionPalette.frontFrom}, ${optionPalette.back})` }}
                />
              )
            })}
          </div>
        </fieldset>

        <fieldset className="mb-3">
          <legend className="font-label-md text-label-md text-on-surface mb-1.5">Icon</legend>
          <div className="flex flex-wrap gap-1">
            {ICONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={option.replace(/_/g, ' ')}
                aria-pressed={icon === option}
                onClick={() => setIcon(option)}
                className={`h-8 w-8 grid place-items-center rounded-lg cursor-pointer transition-colors ${
                  icon === option ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{option}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {parentOptions.length > 0 && (
          <label className="block mb-4">
            <span className="block font-label-md text-label-md text-on-surface mb-1">Inside</span>
            <select
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface-container border border-outline-variant font-body-md text-body-md text-on-surface cursor-pointer outline-none focus:border-primary"
            >
              <option value="">Top level</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-full text-on-surface-variant hover:bg-surface-container cursor-pointer font-label-lg text-label-lg">
            Cancel
          </button>
          <button type="submit" disabled={!name.trim()} className="h-10 px-5 rounded-full bg-primary text-on-primary font-label-lg text-label-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            {folder ? 'Save' : 'Create folder'}
          </button>
        </div>
      </form>
    </div>
  )
}
