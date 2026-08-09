'use client'

import { useState, useTransition, useRef } from 'react'
import Link from 'next/link'
import { updateProfile, updateResume, updateAvatarUrl, ProfileUpdateData } from '../actions/profile-actions'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { ImageCropper } from './image-cropper'
import { AchievementsSection } from './achievements-section'

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
  avatar_url?: string | null
  github_url?: string | null
  linkedin_url?: string | null
  bio?: string | null
}

type TrackerStats = {
  total: number
  applied: number
  interviewing: number
  offers: number
  responseRate: number | null
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
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const [cropImageFile, setCropImageFile] = useState<File | null>(null)

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
    gpa: initialProfile.gpa,
    bio: initialProfile.bio || null,
    github_url: initialProfile.github_url || null,
    linkedin_url: initialProfile.linkedin_url || null
  })

  const [skillInput, setSkillInput] = useState('')
  const [interestInput, setInterestInput] = useState('')

  const displayName = profile.name || 'Student Name'
  const initial = displayName ? displayName.charAt(0).toUpperCase() : 'U'

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
        // If it's a column error, warn but save the rest in UI for now
        if (result.error && result.error.includes('does not exist')) {
          console.warn('Database columns missing. Please run the migration. Preserving UI state.')
          setProfile({ ...profile, ...formData })
          setIsEditing(false)
        } else {
          setError(result.error || 'Failed to update profile')
        }
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
      gpa: profile.gpa,
      bio: profile.bio || null,
      github_url: profile.github_url || null,
      linkedin_url: profile.linkedin_url || null
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed for profile photo.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photo must be less than 5 MB.')
      return
    }

    setCropImageFile(file)
    // Clear input so same file can be selected again
    if (avatarInputRef.current) {
      avatarInputRef.current.value = ''
    }
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropImageFile(null)
    setError(null)
    startTransition(async () => {
      // Use a stable file name for the user's avatar so upsert always replaces the same file
      const filePath = `${profile.id}/avatar.jpeg`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) {
        setError(uploadError.message)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)
        
      // Add a cache-busting timestamp so the frontend immediately shows the fresh image
      const publicUrlWithCacheBuster = `${publicUrl}?t=${Date.now()}`

      const updateResult = await updateAvatarUrl(publicUrlWithCacheBuster)

      if (updateResult.success || (updateResult.error && updateResult.error.includes('does not exist'))) {
        setProfile((prev) => ({
          ...prev,
          avatar_url: publicUrlWithCacheBuster
        }))
      } else {
        setError(updateResult.error || 'Failed to update avatar URL')
      }
    })
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
    <div className="w-full h-full flex flex-col space-y-6 pb-16 pt-2">
      {cropImageFile && (
        <ImageCropper
          imageFile={cropImageFile}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropImageFile(null)}
        />
      )}

      {error && (
        <div className="bg-error/10 text-error px-4 py-3 rounded-2xl text-sm font-medium border border-error/20 flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {/* Profile Header */}
      <section className="bg-surface-container-lowest border border-outline-variant/30 shadow-sm shadow-black/[0.02] rounded-[24px] p-6 flex flex-col md:flex-row items-center md:items-start justify-between gap-6 relative">
        {isPending && (
          <div className="absolute inset-0 bg-surface/30 backdrop-blur-[1px] rounded-[24px] flex items-center justify-center z-20">
            <span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 w-full relative">

          {/* Avatar Container */}
          <div className="relative group shrink-0">
            <div className="w-[120px] h-[120px] rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center font-display text-4xl shrink-0 border-4 border-surface-container-lowest shadow-sm overflow-hidden">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt="Profile" fill className="object-cover" sizes="120px" />
              ) : (
                initial
              )}
            </div>
            {/* Camera Upload Button Overlay */}
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-10 h-10 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-md border-2 border-surface-container-lowest hover:bg-primary/90 transition-colors z-10"
              aria-label="Upload profile photo"
            >
              <span className="material-symbols-outlined text-[20px]">photo_camera</span>
            </button>
            <input
              type="file"
              accept="image/*"
              ref={avatarInputRef}
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          {isEditing ? (
            <div className="flex-1 w-full flex flex-col gap-4 max-w-2xl">
              <div className="flex flex-col gap-1 w-full">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">FULL NAME</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your full name"
                  className="font-headline-sm text-on-surface bg-surface border border-outline-variant rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">University</label>
                  <input
                    type="text"
                    value={formData.university || ''}
                    onChange={e => setFormData({ ...formData, university: e.target.value })}
                    placeholder="University"
                    className="font-body-md text-on-surface bg-surface border border-outline-variant rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Degree</label>
                  <input
                    type="text"
                    value={formData.degree || ''}
                    onChange={e => setFormData({ ...formData, degree: e.target.value })}
                    placeholder="e.g. B.S. Computer Science"
                    className="font-body-md text-on-surface bg-surface border border-outline-variant rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Graduation Year</label>
                  <input
                    type="number"
                    value={formData.graduation_year || ''}
                    onChange={e => setFormData({ ...formData, graduation_year: parseInt(e.target.value) || null })}
                    placeholder="YYYY"
                    className="font-body-md text-on-surface bg-surface border border-outline-variant rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">GPA</label>
                  <input
                    type="text"
                    value={formData.gpa || ''}
                    onChange={e => setFormData({ ...formData, gpa: e.target.value })}
                    placeholder="e.g. 3.8/4.0"
                    className="font-body-md text-on-surface bg-surface border border-outline-variant rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Location / City</label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. San Francisco, CA"
                    className="font-body-md text-on-surface bg-surface border border-outline-variant rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Bio / Tagline</label>
                  <input
                    type="text"
                    value={formData.bio || ''}
                    onChange={e => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Short bio"
                    className="font-body-md text-on-surface bg-surface border border-outline-variant rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">GitHub URL</label>
                  <input
                    type="text"
                    value={formData.github_url || ''}
                    onChange={e => setFormData({ ...formData, github_url: e.target.value })}
                    placeholder="https://github.com/..."
                    className="font-body-md text-on-surface bg-surface border border-outline-variant rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">LinkedIn URL</label>
                  <input
                    type="text"
                    value={formData.linkedin_url || ''}
                    onChange={e => setFormData({ ...formData, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                    className="font-body-md text-on-surface bg-surface border border-outline-variant rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center md:text-left flex-1">
              <h2 className="font-headline-lg text-[26px] font-bold text-on-surface mb-2 tracking-tight">{displayName}</h2>

              {(profile.university || profile.degree) && (
                <div className="flex items-center justify-center md:justify-start gap-2 text-on-surface-variant mb-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">school</span>
                  <span className="font-medium text-[16px]">
                    {profile.university || 'University not set'} {profile.degree && `• ${profile.degree}`}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-outline font-label-md mb-4">
                {profile.graduation_year && (
                  <span className="flex items-center gap-1 bg-surface-container px-3 py-1 rounded-full text-[13px] font-medium text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">workspace_premium</span>
                    Class of {profile.graduation_year}
                  </span>
                )}
                {profile.gpa && (
                  <span className="flex items-center gap-1 bg-surface-container px-3 py-1 rounded-full text-[13px] font-medium text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">grade</span>
                    GPA: {profile.gpa}
                  </span>
                )}
                {profile.city && (
                  <span className="flex items-center gap-1 bg-surface-container px-3 py-1 rounded-full text-[13px] font-medium text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">location_on</span>
                    {profile.city}
                  </span>
                )}
              </div>

              {profile.bio && (
                <p className="text-on-surface-variant max-w-2xl mb-6 leading-relaxed">
                  {profile.bio}
                </p>
              )}

              {/* Social Links Row */}
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                {profile.github_url && (
                  <a href={profile.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface-variant hover:border-outline-variant transition-all text-on-surface font-medium text-sm">
                    {/* SVG for GitHub */}
                    <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                    </svg>
                    GitHub
                  </a>
                )}
                {profile.linkedin_url && (
                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface-variant hover:border-outline-variant transition-all text-on-surface font-medium text-sm">
                    {/* SVG for LinkedIn */}
                    <svg height="16" width="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn
                  </a>
                )}
                <a href={`mailto:${profile.email}`} className="flex items-center gap-2 px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface-variant hover:border-outline-variant transition-all text-on-surface font-medium text-sm">
                  <span className="material-symbols-outlined text-[16px]">mail</span>
                  {profile.email}
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="absolute top-8 right-8">
          {isEditing ? (
            <div className="flex items-center gap-3">
              <button onClick={handleCancel} disabled={isPending} className="px-5 py-2 rounded-full font-semibold text-sm hover:bg-surface-variant transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isPending} className="bg-primary text-on-primary px-6 py-2 rounded-full font-semibold text-sm hover:opacity-90 shadow-sm transition-opacity disabled:opacity-50">
                Save
              </button>
            </div>
          ) : (
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-5 py-2 rounded-full border border-outline-variant font-semibold text-sm hover:bg-surface-variant hover:border-outline transition-colors text-on-surface">
              <span className="material-symbols-outlined text-[18px]">edit</span>
              Edit Profile
            </button>
          )}
        </div>
      </section>

      {/* Career Snapshot Stats */}
      <section className="bg-surface-container-lowest border border-outline-variant/30 shadow-sm shadow-black/[0.02] rounded-[24px] p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[18px] text-on-surface">monitoring</span>
            <h3 className="font-headline-sm text-[18px] font-bold text-on-surface">Application Tracker Stats</h3>
          </div>
          <Link href="/tracker" className="text-sm font-medium text-primary flex items-center gap-1 group">
            Open Tracker <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_right_alt</span>
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <div className="px-4 py-3 rounded-xl bg-surface border border-outline-variant/60 flex flex-col justify-center">
            <div className="text-2xl font-bold leading-none text-on-surface mb-1.5">{stats.total}</div>
            <div className="text-[11px] text-on-surface-variant uppercase tracking-wide font-semibold">Tracked</div>
          </div>
          <div className="px-4 py-3 rounded-xl bg-surface border border-outline-variant/60 flex flex-col justify-center">
            <div className="text-2xl font-bold leading-none text-on-surface mb-1.5">{stats.applied}</div>
            <div className="text-[11px] text-on-surface-variant uppercase tracking-wide font-semibold">Applied</div>
          </div>
          <div className="px-4 py-3 rounded-xl bg-surface border border-outline-variant/60 flex flex-col justify-center">
            <div className="text-2xl font-bold leading-none text-tertiary mb-1.5">{stats.interviewing}</div>
            <div className="text-[11px] text-on-surface-variant uppercase tracking-wide font-semibold">Interviewing</div>
          </div>
          <div className="px-4 py-3 rounded-xl bg-surface border border-outline-variant/60 flex flex-col justify-center">
            <div className="text-2xl font-bold leading-none text-secondary mb-1.5">{stats.offers}</div>
            <div className="text-[11px] text-on-surface-variant uppercase tracking-wide font-semibold">Offers</div>
          </div>
          {stats.responseRate !== null && (
            <div className="px-4 py-3 rounded-xl bg-surface border border-outline-variant/60 flex flex-col justify-center">
              <div className="text-2xl font-bold leading-none text-primary mb-1.5">{stats.responseRate}%</div>
              <div className="text-[11px] text-on-surface-variant uppercase tracking-wide font-semibold">Response rate</div>
            </div>
          )}
        </div>
      </section>

      {/* Main Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {isPending && isEditing && (
          <div className="absolute inset-0 bg-surface/30 backdrop-blur-[1px] rounded-[24px] z-20" />
        )}

        {/* Left Column: Skills, Interests, Goal */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          <div className="bg-surface-container-lowest border border-outline-variant/30 shadow-sm shadow-black/[0.02] rounded-[24px] overflow-hidden">
            {/* Skills Section */}
            <div className="p-6 border-b border-outline-variant/30">
              <div className="flex items-center gap-3 mb-5">
                <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg text-[18px]">build</span>
                <h3 className="font-headline-sm text-[18px] font-bold text-on-surface">Skills</h3>
              </div>

              {isEditing && (
                <div className="flex items-center gap-2 mb-6">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                    placeholder="Add a new skill..."
                    className="flex-1 font-body-md text-on-surface bg-surface border border-outline-variant rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                  <button type="button" onClick={addSkill} className="bg-primary/10 text-primary px-4 py-2 rounded-xl hover:bg-primary/20 transition-colors font-semibold text-sm">
                    Add
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {(isEditing ? formData.skills : profile.skills).map((skill) => (
                  <span key={skill} className="bg-surface px-4 py-2 rounded-full border border-outline-variant/60 font-medium text-sm text-on-surface-variant flex items-center gap-2 hover:border-outline-variant transition-colors shadow-sm shadow-black/[0.01]">
                    {skill}
                    {isEditing && (
                      <button onClick={() => removeSkill(skill)} className="hover:text-error transition-colors flex items-center justify-center -mr-1">
                        <span className="material-symbols-outlined text-[16px]">close</span>
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
            <div className="p-6 border-b border-outline-variant/30 bg-surface-container-lowest">
              <div className="flex items-center gap-3 mb-5">
                <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg text-[18px]">favorite</span>
                <h3 className="font-headline-sm text-[18px] font-bold text-on-surface">Interests</h3>
              </div>

              {isEditing && (
                <div className="flex items-center gap-2 mb-6">
                  <input
                    type="text"
                    value={interestInput}
                    onChange={(e) => setInterestInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest(); } }}
                    placeholder="Add a new interest..."
                    className="flex-1 font-body-md text-on-surface bg-surface border border-outline-variant rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                  <button type="button" onClick={addInterest} className="bg-primary/10 text-primary px-4 py-2 rounded-xl hover:bg-primary/20 transition-colors font-semibold text-sm">
                    Add
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {(isEditing ? formData.interests : profile.interests).map((interest) => (
                  <span key={interest} className="px-4 py-2 rounded-full font-medium text-sm border border-primary/20 bg-primary/5 text-primary flex items-center gap-2 hover:bg-primary/10 transition-colors shadow-sm shadow-black/[0.01]">
                    {interest}
                    {isEditing && (
                      <button onClick={(e) => { e.stopPropagation(); removeInterest(interest); }} className="hover:text-error transition-colors flex items-center justify-center -mr-1 cursor-pointer">
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    )}
                  </span>
                ))}
                {(isEditing ? formData.interests : profile.interests).length === 0 && !isEditing && (
                  <span className="text-outline text-sm italic">No interests added yet.</span>
                )}
              </div>
            </div>

            {/* Career Goal Section */}
            <div className="p-6 bg-surface/50">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg text-[18px]">track_changes</span>
                <h3 className="font-headline-sm text-[18px] font-bold text-on-surface">Career Goal</h3>
              </div>

              <div className="pl-14">
                {isEditing ? (
                  <textarea
                    value={formData.career_goal || ''}
                    onChange={(e) => setFormData({ ...formData, career_goal: e.target.value })}
                    placeholder="What is your main career objective? (e.g., 'I am seeking a summer internship in frontend engineering where I can apply my React skills to build scalable user interfaces.')"
                    className="w-full font-body-md text-on-surface bg-surface border border-outline-variant rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[120px] resize-y transition-all"
                  />
                ) : (
                  <p className="font-body-lg text-[16px] text-on-surface-variant leading-relaxed">
                    {profile.career_goal ? profile.career_goal : <span className="text-outline italic">No career goal set. Click 'Edit Profile' to add one.</span>}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Resume & Settings */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Resume Section */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 shadow-sm shadow-black/[0.02] rounded-[24px] p-5 h-fit">
            <div className="flex items-center gap-3 mb-5">
              <span className="material-symbols-outlined text-[18px] text-on-surface">description</span>
              <h3 className="font-headline-sm text-[18px] font-bold text-on-surface">Resume</h3>
            </div>

            {profile.resume_name ? (
              <div className="flex flex-col gap-4">
                <div className="bg-surface p-4 rounded-xl flex items-start gap-4 border border-outline-variant/40 shadow-sm shadow-black/[0.01]">
                  <div className="w-12 h-12 bg-error/10 text-error rounded-xl flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">picture_as_pdf</span>
                  </div>
                  <div className="overflow-hidden w-full pt-1">
                    <p className="font-semibold text-[15px] text-on-surface truncate" title={profile.resume_name}>{profile.resume_name}</p>
                    <div className="flex items-center gap-2 mt-1 font-medium text-[13px] text-on-surface-variant">
                      <span>PDF</span>
                      <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                      <span>{formatFileSize(profile.resume_size)}</span>
                    </div>
                    <p className="font-medium text-[12px] text-outline mt-2">
                      Uploaded {formatDate(profile.resume_updated_at!)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button onClick={handleViewResume} disabled={isEditing || isPending} className="w-full bg-primary text-on-primary py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm shadow-black/[0.05] disabled:opacity-50">
                    View Resume
                  </button>
                  <div className="flex gap-3">
                    <button onClick={() => fileInputRef.current?.click()} disabled={isEditing || isPending} className="flex-1 border border-outline-variant bg-surface py-2.5 rounded-xl font-semibold text-sm hover:bg-surface-variant hover:border-outline transition-colors text-on-surface disabled:opacity-50">
                      Replace
                    </button>
                    <button onClick={handleDeleteResume} disabled={isEditing || isPending} className="flex-1 border border-error/30 text-error bg-error/5 py-2.5 rounded-xl font-semibold text-sm hover:bg-error/10 hover:border-error/50 transition-colors disabled:opacity-50">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-dashed border-outline-variant/60 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 bg-surface-variant text-on-surface-variant rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">upload_file</span>
                </div>
                <div>
                  <p className="font-semibold text-on-surface text-[15px]">No resume uploaded</p>
                  <p className="text-[13px] text-on-surface-variant mt-1">Upload a PDF up to 5MB</p>
                </div>
                <button onClick={() => fileInputRef.current?.click()} disabled={isEditing || isPending} className="mt-2 bg-surface-variant text-on-surface-variant px-5 py-2 rounded-full font-semibold text-sm hover:bg-outline-variant transition-colors disabled:opacity-50 cursor-pointer">
                  Select File
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
          <AchievementsSection userId={profile.id} isEditingProfile={isEditing} />


        </div>
      </div>
    </div>
  )
}
