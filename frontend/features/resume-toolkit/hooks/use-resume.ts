'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createResume, updateResume, getResumeBySlug } from '@/features/resume-toolkit/services/resume-actions'
import type { ResumeData } from '@/features/resume-toolkit/lib/schema/resume/data'
import { defaultResumeData } from '@/features/resume-toolkit/lib/schema/resume/default'
import {
  type EditHistory,
  createEditHistory,
  recordEdit,
  undoEdit,
  redoEdit,
  canUndo,
  canRedo,
} from '@/features/resume-toolkit/lib/edit-history'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseResumeOptions {
  slug?: string
  initialData?: ResumeData
  initialTitle?: string
  initialId?: string
}

export function useResume({ slug, initialData, initialTitle, initialId }: UseResumeOptions = {}) {
  // Resume content lives inside an undo/redo timeline rather than plain state;
  // `history.present` is the document as currently shown.
  const [history, setHistory] = useState<EditHistory<ResumeData>>(() =>
    createEditHistory(initialData ?? defaultResumeData)
  )
  const resumeData = history.present
  const [title, setTitle] = useState(initialTitle ?? 'Untitled Resume')
  const [resumeId, setResumeId] = useState<string | null>(initialId ?? null)
  const [resumeSlug, setResumeSlug] = useState<string | null>(slug ?? null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [loading, setLoading] = useState(!!slug && !initialData)

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Use refs to always have the latest values inside the save callback,
  // synced via useEffect to comply with React's ref mutation rules.
  const dataRef = useRef(resumeData)
  const titleRef = useRef(title)
  const idRef = useRef(resumeId)

  useEffect(() => { dataRef.current = resumeData }, [resumeData])
  useEffect(() => { titleRef.current = title }, [title])
  useEffect(() => { idRef.current = resumeId }, [resumeId])

  // Load existing resume
  useEffect(() => {
    if (!slug || initialData) return

    let cancelled = false
    getResumeBySlug(slug).then((result) => {
      if (cancelled) return
      if (result.success && result.resume) {
        // Loading a document starts a fresh timeline — there is nothing
        // meaningful to undo "past" the resume as it was opened.
        setHistory(createEditHistory(result.resume.data as ResumeData))
        setTitle(result.resume.title)
        setResumeId(result.resume.id)
        setResumeSlug(result.resume.slug)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [slug, initialData])

  /**
   * Persists the resume and resolves with its id, or null if the save failed.
   *
   * The id is returned rather than read from `resumeId` because a brand-new
   * resume only gets one at insert time, and callers that need to act on the
   * saved row straight away (Download PDF) cannot wait for a re-render.
   */
  const save = useCallback(async (): Promise<string | null> => {
    // An explicit save supersedes a debounced one — drop the pending timer so
    // it doesn't fire a second, redundant write moments later.
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }

    setSaveStatus('saving')
    try {
      if (idRef.current) {
        // Update existing
        const result = await updateResume(idRef.current, {
          title: titleRef.current,
          data: dataRef.current,
        })
        setSaveStatus(result.success ? 'saved' : 'error')
        return result.success ? idRef.current : null
      }

      // Create new
      const result = await createResume(titleRef.current, dataRef.current)
      if (result.success && result.id) {
        // Written straight to the ref as well as to state: the useEffect that
        // normally syncs it only runs after a render, and a save queued before
        // then would still see a null id and insert a *second* resume.
        idRef.current = result.id
        setResumeId(result.id)
        setResumeSlug(result.slug ?? null)
        setSaveStatus('saved')
        // Update URL to reflect the slug without a full navigation
        if (result.slug) {
          window.history.replaceState(null, '', `/resume/builder/${result.slug}`)
        }
        return result.id
      }

      setSaveStatus('error')
      return null
    } catch {
      setSaveStatus('error')
      return null
    }
  }, [])

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }
    autosaveTimerRef.current = setTimeout(() => {
      save()
    }, 2000) // Debounce 2 seconds
  }, [save])

  const updateSection = useCallback(<K extends keyof ResumeData>(
    key: K,
    value: ResumeData[K]
  ) => {
    setHistory(prev => recordEdit(prev, { ...prev.present, [key]: value }, Date.now()))
    scheduleAutosave()
  }, [scheduleAutosave])

  const updateSectionItems = useCallback((
    sectionKey: string,
    items: unknown[]
  ) => {
    setHistory(prev => recordEdit(prev, {
      ...prev.present,
      sections: {
        ...prev.present.sections,
        [sectionKey]: {
          ...prev.present.sections[sectionKey as keyof typeof prev.present.sections],
          items,
        }
      }
    }, Date.now()))
    scheduleAutosave()
  }, [scheduleAutosave])

  // Undo/redo autosave like any other edit — a reverted document is the
  // document now, and leaving it unsaved would resurrect on the next load.
  const undo = useCallback(() => {
    setHistory(prev => undoEdit(prev))
    scheduleAutosave()
  }, [scheduleAutosave])

  const redo = useCallback(() => {
    setHistory(prev => redoEdit(prev))
    scheduleAutosave()
  }, [scheduleAutosave])

  const updateTitle = useCallback((newTitle: string) => {
    setTitle(newTitle)
    scheduleAutosave()
  }, [scheduleAutosave])

  // Cleanup autosave timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [])

  return {
    resumeData,
    title,
    updateTitle,
    resumeId,
    resumeSlug,
    saveStatus,
    loading,
    save,
    updateSection,
    updateSectionItems,
    undo,
    redo,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
  }
}
