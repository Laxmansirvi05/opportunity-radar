'use client'

import { useState, useTransition, useRef } from 'react'
import Link from 'next/link'
import { updateProfile, updateResume, ProfileUpdateData } from '../actions/profile-actions'
import { createClient } from '@/lib/supabase/client'

type ProfileData = {
  id: string
  name: string
  email: string
  university: string | null
  degree: string | null
  graduation_year: number | null
  skills: string[]
  interests: string[]
  career_goal: string | null
  resume_name: string | null
  resume_size: number | null
  resume_updated_at: string | null
  resume_url: string | null
  city: string | null
  gpa: string | null
}

type TrackerStats = {
  saved: number
  applied: number
  interviews: number
}

interface ProfileManagerProps {
  initialProfile: ProfileData
  stats: TrackerStats
}

const formatDate = (isoString: string) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return ''
  const m = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  const y = date.getUTCFullYear()
  return `${m}/${d}/${y}`
}

export function ProfileManager({ initialProfile, stats }: ProfileManagerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [profile, setProfile] = useState<ProfileData>(initialProfile)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Form State
  const [formData, setFormData] = useState<ProfileUpdateData>({
    name: initialProfile.name,
    university: initialProfile.university,
    degree: initialProfile.degree,
    graduation_year: initialProfile.graduation_year,
    skills: initialProfile.skills || [],
    interests: initialProfile.interests || [],
    career_goal: initialProfile.career_goal,
    city: initialProfile.city,
    gpa: initialProfile.gpa
  })

  const [skillInput, setSkillInput] = useState('')
  const [interestInput, setInterestInput] = useState('')

  const initial = profile.email ? profile.email.charAt(0).toUpperCase() : 'U'
  const displayName = profile.name || profile.email

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '0 KB'
    const kb = bytes / 1024
    if (kb > 1024) return `${(kb / 1024).toFixed(1)} MB`
    return `${Math.round(kb)} KB`
  }

  const handleSave = () => {
    setError(null)

    // Basic validation
    if (!formData.name.trim()) {
      setError('Name is required')
      return
    }

    startTransition(async () => {
      const result = await updateProfile(formData)
      if (result.success) {
        setProfile({ ...profile, ...formData })
        setIsEditing(false)
      } else {
        setError(result.error || 'Failed to update profile')
      }
    })
  }

  const handleCancel = () => {
    setFormData({
      name: profile.name,
      university: profile.university,
      degree: profile.degree,
      graduation_year: profile.graduation_year,
      skills: profile.skills || [],
      interests: profile.interests || [],
      career_goal: profile.career_goal,
      city: profile.city,
      gpa: profile.gpa
    })
    setError(null)
    setIsEditing(false)
  }

  const addSkill = () => {
    const trimmed = skillInput.trim()
    if (trimmed && !formData.skills.includes(trimmed)) {
      setFormData({ ...formData, skills: [...formData.skills, trimmed] })
      setSkillInput('')
    }
  }

  const removeSkill = (skill: string) => {
    setFormData({ ...formData, skills: formData.skills.filter(s => s !== skill) })
  }

  const addInterest = () => {
    const trimmed = interestInput.trim()
    if (trimmed && !formData.interests.includes(trimmed)) {
      setFormData({ ...formData, interests: [...formData.interests, trimmed] })
      setInterestInput('')
    }
  }

  const removeInterest = (interest: string) => {
    setFormData({ ...formData, interests: formData.interests.filter(i => i !== interest) })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5 MB.')
      return
    }

    setError(null)
    startTransition(async () => {
      const filePath = `${profile.id}/resume.pdf`
      
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        setError(uploadError.message)
        return
      }

      const updateResult = await updateResume({
        resume_name: file.name,
        resume_size: file.size,
        resume_url: null,
        resume_updated_at: new Date().toISOString()
      })

      if (updateResult.success) {
        setProfile((prev) => ({
          ...prev,
          resume_name: file.name,
          resume_size: file.size,
          resume_updated_at: new Date().toISOString()
        }))
      } else {
        setError(updateResult.error || 'Failed to update resume metadata')
      }
    })
  }

  const handleViewResume = async () => {
    const filePath = `${profile.id}/resume.pdf`
    const { data, error } = await supabase.storage.from('resumes').createSignedUrl(filePath, 60)
    if (error || !data) {
      setError('Failed to generate resume link')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  const handleDeleteResume = async () => {
    if (!window.confirm('Are you sure you want to delete your resume?')) return

    startTransition(async () => {
      const filePath = `${profile.id}/resume.pdf`
      const { error: deleteError } = await supabase.storage.from('resumes').remove([filePath])
      
      if (deleteError) {
        setError(deleteError.message)
        return
      }

      const updateResult = await updateResume({
        resume_name: null,
        resume_size: null,
        resume_url: null,
        resume_updated_at: null
      })

      if (updateResult.success) {
        setProfile((prev) => ({
          ...prev,
          resume_name: null,
          resume_size: null,
          resume_updated_at: null,
          resume_url: null
        }))
      } else {
        setError(updateResult.error || 'Failed to update resume metadata')
      }
    })
  }

  return (
    <div className="max-w-container-max mx-auto space-y-lg pb-16">
      {/* Profile Header */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col md:flex-row items-center md:items-start justify-between gap-md relative">
        {isPending && (
          <div className="absolute inset-0 bg-surface/50 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-10">
            <span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span>
          </div>
        )}
        
        <div className="flex flex-col md:flex-row items-center gap-lg w-full">
          <div aria-label="Initials" className="w-24 h-24 rounded-full bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-center font-display text-headline-lg shrink-0">
            {initial}
          </div>
          
          {isEditing ? (
            <div className="flex-1 w-full flex flex-col gap-3">
              <div className="flex flex-col gap-1 w-full">
                <label htmlFor="name" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">FULL NAME</label>
                <input 
                  id="name"
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="Enter your full name"
                  className="font-headline-sm text-headline-sm text-on-surface bg-surface border-2 border-outline-variant rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-primary focus:border-primary w-full transition-all"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input 
                  type="text" 
                  value={formData.university || ''} 
                  onChange={e => setFormData({...formData, university: e.target.value})} 
                  placeholder="University"
                  className="font-body-md text-on-surface-variant bg-surface border border-outline-variant rounded-md px-3 py-1 outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-outline">•</span>
                <input 
                  type="text" 
                  value={formData.degree || ''} 
                  onChange={e => setFormData({...formData, degree: e.target.value})} 
                  placeholder="Degree (e.g. B.S. Computer Science)"
                  className="font-body-md text-on-surface-variant bg-surface border border-outline-variant rounded-md px-3 py-1 outline-none focus:ring-1 focus:ring-primary min-w-[250px]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-label-md text-outline">Class of</span>
                <input 
                  type="number" 
                  value={formData.graduation_year || ''} 
                  onChange={e => setFormData({...formData, graduation_year: parseInt(e.target.value) || null})} 
                  placeholder="YYYY"
                  className="font-label-md text-on-surface bg-surface border border-outline-variant rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-primary w-24"
                />
                <span className="text-outline mx-2">•</span>
                <input 
                  type="text" 
                  value={formData.gpa || ''} 
                  onChange={e => setFormData({...formData, gpa: e.target.value})} 
                  placeholder="CGPA/GPA (e.g. 3.8/4.0)"
                  className="font-label-md text-on-surface bg-surface border border-outline-variant rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-primary w-40"
                />
                <span className="text-outline mx-2">•</span>
                <input 
                  type="text" 
                  value={formData.city || ''} 
                  onChange={e => setFormData({...formData, city: e.target.value})} 
                  placeholder="City (e.g. San Francisco, CA)"
                  className="font-label-md text-on-surface bg-surface border border-outline-variant rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-primary min-w-[200px]"
                />
              </div>
            </div>
          ) : (
            <div className="text-center md:text-left">
              <h2 className="font-headline-lg text-headline-lg text-on-surface">{displayName}</h2>
              {(profile.university || profile.degree) && (
                <p className="font-body-lg text-body-lg text-on-surface-variant">
                  {profile.university || 'University not set'} {profile.degree && `• ${profile.degree}`}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-1 text-outline font-label-md text-label-md">
                {profile.graduation_year && <span>Class of {profile.graduation_year}</span>}
                {profile.graduation_year && profile.gpa && <span>•</span>}
                {profile.gpa && <span>GPA: {profile.gpa}</span>}
                {(profile.graduation_year || profile.gpa) && profile.city && <span>•</span>}
                {profile.city && <span>{profile.city}</span>}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 min-w-[120px] shrink-0">
          {isEditing ? (
            <>
              <button onClick={handleSave} disabled={isPending} className="bg-primary text-on-primary px-lg py-sm rounded-full font-label-md text-label-md hover:opacity-90 transition-opacity cursor-pointer text-center disabled:opacity-50">
                Save
              </button>
              <button onClick={handleCancel} disabled={isPending} className="border border-outline-variant text-on-surface-variant px-lg py-sm rounded-full font-label-md text-label-md hover:bg-surface-variant transition-colors cursor-pointer text-center disabled:opacity-50">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="bg-primary text-on-primary px-lg py-sm rounded-full font-label-md text-label-md hover:opacity-90 transition-opacity cursor-pointer">
              Edit Profile
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="bg-error/10 text-error px-4 py-3 rounded-lg text-sm font-medium border border-error/20 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {/* Career Snapshot */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
        <Link href="/profile/saved" className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl hover:border-primary transition-colors block cursor-pointer">
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Saved</p>
          <p className="font-headline-md text-headline-md mt-xs">{stats.saved}</p>
        </Link>
        <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl hover:border-primary transition-colors">
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Applied</p>
          <p className="font-headline-md text-headline-md mt-xs">{stats.applied}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl hover:border-primary transition-colors">
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Interviews</p>
          <p className="font-headline-md text-headline-md mt-xs">{stats.interviews}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl hover:border-primary transition-colors">
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Success Rate</p>
          <p className="font-headline-md text-headline-md text-secondary mt-xs">
            {stats.applied > 0 ? Math.round((stats.interviews / stats.applied) * 100) : 0}%
          </p>
        </div>
      </section>

      {/* Main Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter relative">
        {isPending && isEditing && (
          <div className="absolute inset-0 bg-surface/30 backdrop-blur-[1px] rounded-xl z-10" />
        )}
        
        {/* Left Column: Skills & Interests */}
        <div className="lg:col-span-8 space-y-gutter">
          {/* Skills Section */}
          <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl">
            <div className="flex justify-between items-center mb-md">
              <h3 className="font-headline-sm text-headline-sm">Skills</h3>
            </div>
            
            {isEditing && (
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                  placeholder="Add a skill..."
                  className="flex-1 font-body-sm text-on-surface bg-surface border border-outline-variant rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
                />
                <button type="button" onClick={addSkill} className="bg-surface-variant text-on-surface-variant px-3 py-2 rounded-md hover:bg-outline-variant transition-colors font-medium text-sm">
                  Add
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-sm">
              {(isEditing ? formData.skills : profile.skills).map((skill) => (
                <span key={skill} className="bg-surface-variant px-md py-sm rounded-full font-label-md text-label-md text-on-surface-variant flex items-center gap-1">
                  {skill}
                  {isEditing && (
                    <button onClick={() => removeSkill(skill)} className="hover:text-error transition-colors flex items-center justify-center">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </span>
              ))}
              {(isEditing ? formData.skills : profile.skills).length === 0 && !isEditing && (
                <span className="text-outline text-sm italic">No skills added yet.</span>
              )}
            </div>
          </div>

          {/* Interests Section */}
          <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl">
            <h3 className="font-headline-sm text-headline-sm mb-md">Interests</h3>
            
            {isEditing && (
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest(); } }}
                  placeholder="Add an interest..."
                  className="flex-1 font-body-sm text-on-surface bg-surface border border-outline-variant rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
                />
                <button type="button" onClick={addInterest} className="bg-surface-variant text-on-surface-variant px-3 py-2 rounded-md hover:bg-outline-variant transition-colors font-medium text-sm">
                  Add
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-sm">
              {(isEditing ? formData.interests : profile.interests).map((interest) => (
                <button key={interest} className="px-md py-sm rounded-full font-label-md text-label-md border border-primary bg-primary-container text-on-primary-container flex items-center gap-1">
                  {interest}
                  {isEditing && (
                    <span onClick={(e) => { e.stopPropagation(); removeInterest(interest); }} className="hover:text-error transition-colors flex items-center justify-center cursor-pointer material-symbols-outlined text-[14px]">
                      close
                    </span>
                  )}
                </button>
              ))}
              {(isEditing ? formData.interests : profile.interests).length === 0 && !isEditing && (
                <span className="text-outline text-sm italic">No interests added yet.</span>
              )}
            </div>
          </div>

          {/* Career Goal Section */}
          <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl">
            <h3 className="font-headline-sm text-headline-sm mb-md">Career Goal</h3>
            {isEditing ? (
              <textarea
                value={formData.career_goal || ''}
                onChange={(e) => setFormData({ ...formData, career_goal: e.target.value })}
                placeholder="What is your main career objective?"
                className="w-full font-body-md text-on-surface bg-surface border border-outline-variant rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-y"
              />
            ) : (
              <p className="font-body-md text-body-md text-on-surface italic">
                {profile.career_goal ? `"${profile.career_goal}"` : <span className="text-outline">No career goal set.</span>}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Resume & Settings */}
        <div className="lg:col-span-4 space-y-gutter">
          {/* Resume Section */}
          <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl h-fit">
            <h3 className="font-headline-sm text-headline-sm mb-md">Resume</h3>
            
            {profile.resume_name ? (
              <>
                <div className="bg-surface-container-low p-md rounded-lg flex items-center gap-sm mb-md border border-outline-variant/30">
                  <span className="material-symbols-outlined text-primary text-3xl">description</span>
                  <div className="overflow-hidden">
                    <p className="font-label-md text-label-md text-on-surface truncate">Resume Uploaded</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant truncate">{profile.resume_name}</p>
                    <p className="font-label-sm text-label-sm text-outline">
                      {formatFileSize(profile.resume_size)}
                    </p>
                    <p className="font-label-sm text-label-sm text-primary mt-xs">
                      Updated: {formatDate(profile.resume_updated_at!)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-sm">
                  <button onClick={handleViewResume} disabled={isEditing || isPending} className="flex-1 bg-primary-container text-on-primary-container py-sm rounded-lg font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-colors cursor-pointer text-center flex items-center justify-center disabled:opacity-50">
                    View
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} disabled={isEditing || isPending} className="flex-1 border border-outline-variant py-sm rounded-lg font-label-md text-label-md hover:bg-surface-variant transition-colors cursor-pointer disabled:opacity-50">
                    Replace
                  </button>
                  <button onClick={handleDeleteResume} disabled={isEditing || isPending} className="flex-1 border border-error text-error py-sm rounded-lg font-label-md text-label-md hover:bg-error/10 transition-colors cursor-pointer disabled:opacity-50">
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-surface-container-low border border-dashed border-outline-variant rounded-lg p-6 flex flex-col items-center justify-center text-center gap-2">
                <span className="material-symbols-outlined text-outline text-3xl">upload_file</span>
                <p className="font-label-md text-on-surface-variant">No resume uploaded</p>
                <button onClick={() => fileInputRef.current?.click()} disabled={isEditing || isPending} className="mt-2 text-primary font-label-md font-bold hover:underline disabled:opacity-50 cursor-pointer">
                  Upload PDF
                </button>
              </div>
            )}
            <input 
              type="file" 
              accept="application/pdf" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload}
            />
          </div>

          {/* Account Settings */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden h-fit">
            <div className="p-lg pb-sm">
              <h3 className="font-headline-sm text-headline-sm">Account Settings</h3>
            </div>
            <div className="flex flex-col">
              <button disabled={isEditing} className="flex items-center justify-between p-lg hover:bg-surface-variant transition-colors group cursor-pointer disabled:opacity-50">
                <div className="flex items-center gap-md">
                  <span className="material-symbols-outlined text-outline group-hover:text-primary">lock</span>
                  <span className="font-body-md text-body-md text-on-surface">Change Password</span>
                </div>
                <span className="material-symbols-outlined text-outline">chevron_right</span>
              </button>
              <button disabled={isEditing} className="flex items-center justify-between p-lg hover:bg-surface-variant transition-colors group border-t border-outline-variant cursor-pointer disabled:opacity-50">
                <div className="flex items-center gap-md">
                  <span className="material-symbols-outlined text-outline group-hover:text-primary">notifications_active</span>
                  <span className="font-body-md text-body-md text-on-surface">Notification Preferences</span>
                </div>
                <span className="material-symbols-outlined text-outline">chevron_right</span>
              </button>
              <button disabled={isEditing} className="flex items-center justify-between p-lg hover:bg-surface-variant transition-colors group border-t border-outline-variant cursor-pointer disabled:opacity-50">
                <div className="flex items-center gap-md">
                  <span className="material-symbols-outlined text-outline group-hover:text-primary">security</span>
                  <span className="font-body-md text-body-md text-on-surface">Privacy Settings</span>
                </div>
                <span className="material-symbols-outlined text-outline">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
