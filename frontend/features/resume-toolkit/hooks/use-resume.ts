'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createResume, updateResume, getResumeBySlug } from '@/features/resume-toolkit/services/resume-actions'
import type { ResumeData } from '@/features/resume-toolkit/lib/schema/resume/data'
import { defaultResumeData } from '@/features/resume-toolkit/lib/schema/resume/default'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseResumeOptions {
  slug?: string
  initialData?: ResumeData
  initialTitle?: string
  initialId?: string
}

export function useResume({ slug, initialData, initialTitle, initialId }: UseResumeOptions = {}) {
  const [resumeData, setResumeData] = useState<ResumeData>(initialData ?? defaultResumeData)
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
        setResumeData(result.resume.data as ResumeData)
        setTitle(result.resume.title)
        setResumeId(result.resume.id)
        setResumeSlug(result.resume.slug)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [slug, initialData])

  const save = useCallback(async () => {
    setSaveStatus('saving')
    try {
      if (idRef.current) {
        // Update existing
        const result = await updateResume(idRef.current, {
          title: titleRef.current,
          data: dataRef.current,
        })
        setSaveStatus(result.success ? 'saved' : 'error')
      } else {
        // Create new
        const result = await createResume(titleRef.current, dataRef.current)
        if (result.success && result.id) {
          setResumeId(result.id)
          setResumeSlug(result.slug ?? null)
          setSaveStatus('saved')
          // Update URL to reflect the slug without a full navigation
          if (result.slug) {
            window.history.replaceState(null, '', `/resume/builder/${result.slug}`)
          }
        } else {
          setSaveStatus('error')
        }
      }
    } catch {
      setSaveStatus('error')
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
    setResumeData(prev => ({ ...prev, [key]: value }))
    scheduleAutosave()
  }, [scheduleAutosave])

  const updateSectionItems = useCallback((
    sectionKey: string,
    items: unknown[]
  ) => {
    setResumeData(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionKey]: {
          ...prev.sections[sectionKey as keyof typeof prev.sections],
          items,
        }
      }
    }))
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
    setResumeData,
    title,
    updateTitle,
    resumeId,
    resumeSlug,
    saveStatus,
    loading,
    save,
    updateSection,
    updateSectionItems,
  }
}
