'use client'

import { useState, useEffect, useMemo, useCallback, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { safeExternalUrl } from '@/lib/safe-url'

export type Achievement = {
  id: string
  user_id: string
  title: string
  description: string | null
  date_year: string | null
  organization: string | null
  credential_url: string | null
  created_at: string
}

interface AchievementsSectionProps {
  userId: string
}

export function AchievementsSection({ userId }: AchievementsSectionProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date_year: '',
    organization: '',
    credential_url: ''
  })
  const [error, setError] = useState<string | null>(null)

  // `createClient()` builds a fresh browser client per call, so it has to be
  // memoized to be usable as a hook dependency below.
  const supabase = useMemo(() => createClient(), [])

  const fetchAchievements = useCallback(async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // This used to be `if (!error && data)` with no else, so a failed read left
    // `achievements` empty and the component rendered "No achievements added
    // yet" — reporting a broken query as an empty list, and inviting the user to
    // re-add records that are still there.
    if (fetchError) {
      console.error('[Achievements] load failed:', fetchError)
      setLoadFailed(true)
    } else {
      setAchievements(data ?? [])
      setLoadFailed(false)
    }
    setLoading(false)
  }, [supabase, userId])

  // Declared above the effect that calls it, and listed as a dependency: the
  // effect used to reach backwards to a `const` defined below it with an empty
  // dependency array, so it never refetched when `userId` changed.
  useEffect(() => {
    // Defer the initial asynchronous read so React finishes committing this
    // client component before the loading state changes.
    const loadId = window.setTimeout(() => {
      void fetchAchievements()
    }, 0)

    return () => window.clearTimeout(loadId)
  }, [fetchAchievements])

  const resetForm = () => {
    setFormData({ title: '', description: '', date_year: '', organization: '', credential_url: '' })
    setError(null)
    setIsAdding(false)
    setEditingId(null)
  }

  const handleEdit = (achievement: Achievement) => {
    setFormData({
      title: achievement.title,
      description: achievement.description || '',
      date_year: achievement.date_year || '',
      organization: achievement.organization || '',
      credential_url: achievement.credential_url || ''
    })
    setEditingId(achievement.id)
    setIsAdding(false)
  }

  const handleSave = async () => {
    if (!formData.title.trim()) {
      setError('Title is required')
      return
    }

    // The `type="url"` input below is not inside a `<form>` and this is an
    // `onClick` rather than a submit, so the browser never runs its own
    // constraint validation — and the write goes straight to Postgres from the
    // client, so there is no server check either. Nothing validated this field
    // at all, while `hub-profile-modal.tsx` renders it as an `href` to other
    // members: a `javascript:` value here was stored XSS in their sessions.
    const credentialUrl = formData.credential_url.trim()
      ? safeExternalUrl(formData.credential_url)
      : null
    if (formData.credential_url.trim() && !credentialUrl) {
      setError('Credential URL must be a valid http:// or https:// address.')
      return
    }

    startTransition(async () => {
      setError(null)
      const fields = {
        title: formData.title,
        description: formData.description || null,
        date_year: formData.date_year || null,
        organization: formData.organization || null,
        credential_url: credentialUrl,
      }

      if (editingId) {
        const { error: updateError } = await supabase
          .from('achievements')
          // `user_id` is deliberately not in the update payload: it is not the
          // user's to change, and sending it was an ownership rewrite that only
          // RLS's `with check` was stopping. The `user_id` filter is the house
          // defence-in-depth rule — RLS scopes this too, but every mutation
          // carries the explicit filter.
          .update(fields)
          .eq('id', editingId)
          .eq('user_id', userId)

        if (updateError) {
          setError(updateError.message)
        } else {
          await fetchAchievements()
          resetForm()
        }
      } else {
        const { error: insertError } = await supabase
          .from('achievements')
          .insert([{ ...fields, user_id: userId }])

        if (insertError) {
          if (insertError.message.includes('relation "public.achievements" does not exist')) {
            setError('The achievements table does not exist. Please run the SQL migration.')
          } else {
            setError(insertError.message)
          }
        } else {
          await fetchAchievements()
          resetForm()
        }
      }
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this achievement?')) return

    startTransition(async () => {
      const { error: deleteError } = await supabase
        .from('achievements')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (deleteError) {
        setError(deleteError.message)
      } else {
        await fetchAchievements()
      }
    })
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 shadow-sm shadow-black/[0.02] rounded-[24px] overflow-hidden">
      <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg text-[18px]">military_tech</span>
          <h3 className="font-headline-sm text-[18px] font-bold text-on-surface">Achievements</h3>
        </div>
        {!isAdding && !editingId && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add
          </button>
        )}
      </div>
      
      <div className="p-6 relative">
        {(isPending || loading) && (
          <div className="absolute inset-0 bg-surface/30 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span>
          </div>
        )}

        {error && (
          <div className="bg-error/10 text-error px-4 py-3 rounded-xl text-sm font-medium border border-error/20 flex items-start gap-2 mb-4">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <p>{error}</p>
          </div>
        )}

        {(isAdding || editingId) ? (
          <div className="bg-surface border border-outline-variant/50 rounded-xl p-5 mb-4 shadow-sm">
            <h4 className="font-semibold text-on-surface mb-4">{editingId ? 'Edit Achievement' : 'Add Achievement'}</h4>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Title *</label>
                <input 
                  type="text" 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  placeholder="e.g. AWS Certified Solutions Architect"
                  className="font-body-md text-on-surface bg-surface-container border border-outline-variant rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Organization / Issuer</label>
                  <input 
                    type="text" 
                    value={formData.organization} 
                    onChange={e => setFormData({...formData, organization: e.target.value})} 
                    placeholder="e.g. Amazon Web Services"
                    className="font-body-md text-on-surface bg-surface-container border border-outline-variant rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Date / Year</label>
                  <input 
                    type="text" 
                    value={formData.date_year} 
                    onChange={e => setFormData({...formData, date_year: e.target.value})} 
                    placeholder="e.g. 2023"
                    className="font-body-md text-on-surface bg-surface-container border border-outline-variant rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Credential URL (Optional)</label>
                <input 
                  type="url" 
                  value={formData.credential_url} 
                  onChange={e => setFormData({...formData, credential_url: e.target.value})} 
                  placeholder="https://..."
                  className="font-body-md text-on-surface bg-surface-container border border-outline-variant rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Description</label>
                <textarea 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  placeholder="Brief description of the achievement..."
                  className="font-body-md text-on-surface bg-surface-container border border-outline-variant rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[80px] resize-y"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={resetForm}
                disabled={isPending}
                className="px-4 py-2 rounded-full font-semibold text-sm text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isPending}
                className="px-5 py-2 rounded-full font-semibold text-sm bg-primary text-on-primary hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                Save Achievement
              </button>
            </div>
          </div>
        ) : loadFailed ? (
          <div className="text-center py-8 bg-surface/30 rounded-xl border border-outline-variant/30 border-dashed">
            <span className="material-symbols-outlined text-[32px] text-error/70 mb-3">error</span>
            <p className="font-semibold text-on-surface text-[15px]">Achievements could not be loaded</p>
            <p className="text-[13px] text-on-surface-variant mt-1">Your saved records have not been changed.</p>
            <button
              onClick={fetchAchievements}
              className="mt-4 px-4 py-2 border border-outline-variant rounded-full text-sm font-semibold text-on-surface hover:bg-surface-variant transition-colors"
            >
              Try again
            </button>
          </div>
        ) : (
          achievements.length > 0 ? (
            <div className="flex flex-col gap-4">
              {achievements.map((achievement) => {
                // Guarded at render too: rows written before the save-time check
                // existed are still in the table.
                const credentialUrl = safeExternalUrl(achievement.credential_url)
                return (
                <div key={achievement.id} className="group relative flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 rounded-xl hover:bg-surface-variant/30 transition-colors border border-transparent hover:border-outline-variant/30">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-surface border border-outline-variant/50 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px] text-primary">emoji_events</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-on-surface">{achievement.title}</h4>
                      {(achievement.organization || achievement.date_year) && (
                        <p className="text-sm text-on-surface-variant font-medium mt-0.5 flex flex-wrap gap-x-2 gap-y-1">
                          {achievement.organization && <span>{achievement.organization}</span>}
                          {achievement.organization && achievement.date_year && <span className="opacity-50">•</span>}
                          {achievement.date_year && <span>{achievement.date_year}</span>}
                        </p>
                      )}
                      {achievement.description && (
                        <p className="text-sm text-on-surface-variant mt-2 leading-relaxed max-w-2xl">
                          {achievement.description}
                        </p>
                      )}
                      {credentialUrl && (
                        <a
                          href={credentialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-primary mt-3 hover:underline"
                        >
                          View Credential
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-4 sm:relative sm:right-auto sm:top-auto bg-surface sm:bg-transparent rounded-lg shadow-sm sm:shadow-none p-1 sm:p-0">
                    <button 
                      onClick={() => handleEdit(achievement)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant text-on-surface-variant hover:text-primary transition-colors"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button 
                      onClick={() => handleDelete(achievement.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 bg-surface/30 rounded-xl border border-outline-variant/30 border-dashed">
              <span className="material-symbols-outlined text-[32px] text-on-surface-variant/50 mb-3">military_tech</span>
              <p className="font-semibold text-on-surface text-[15px]">No achievements added yet</p>
              <p className="text-[13px] text-on-surface-variant mt-1">Add your certifications, awards, and milestones.</p>
              <button 
                onClick={() => setIsAdding(true)}
                className="mt-4 px-4 py-2 border border-outline-variant rounded-full text-sm font-semibold text-on-surface hover:bg-surface-variant transition-colors"
              >
                + Add Achievement
              </button>
            </div>
          )
        )}
      </div>
    </div>
  )
}
