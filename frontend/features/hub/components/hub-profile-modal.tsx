'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import type { HubSender } from '../types'
import { getPublicProfile } from '../actions/get-public-profile'

interface HubProfileModalProps {
  senderId: string
  sender: HubSender
  onClose: () => void
}

type PublicProfile = Awaited<ReturnType<typeof getPublicProfile>>

export function HubProfileModal({ senderId, sender, onClose }: HubProfileModalProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Prevent body scroll when open, and close on Escape (matches the lightbox)
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    let mounted = true
    async function loadProfile() {
      setIsLoading(true)
      try {
        const data = await getPublicProfile(senderId)
        if (mounted) setProfile(data)
      } catch (err) {
        // The server action can throw (RLS denial, transient DB error, etc).
        // Falling through to the basic `sender` prop below is the whole
        // reason this is safe to swallow here — never leave the modal
        // stuck on "Loading profile..." forever because of it.
        console.error('[Hub] Failed to load public profile:', err)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    loadProfile()
    return () => { mounted = false }
  }, [senderId])

  // Fallback to basic sender info if profile load fails or is loading
  const displayName = profile?.name ?? sender.name ?? 'Student'
  const initial = displayName.charAt(0).toUpperCase()
  const avatarUrl = profile?.avatar_url ?? sender.avatar_url

  const renderSocialUrl = (url: string | null | undefined, prefix: string = '') => {
    if (!url) return null
    const trimmed = url.trim()
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed
    }
    return `https://${prefix}${trimmed}`
  }

  const linkedinUrl = renderSocialUrl(profile?.linkedin_url ?? sender.linkedin_url)
  const githubUrl = renderSocialUrl(profile?.github_url, 'github.com/')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        // max-w-md avoided: --spacing-md in app/globals.css collides with
        // Tailwind's container scale and silently resolves max-w-md to 16px
        // project-wide (see UI-03 in the issue tracker).
        className="relative bg-surface rounded-3xl shadow-xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[85vh]"
        style={{ maxWidth: '28rem' }}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors z-10 cursor-pointer"
          aria-label="Close profile"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="pt-6 pb-5 px-5 flex flex-col items-center text-center overflow-y-auto w-full">
          <div className="relative w-20 h-20 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-2xl overflow-hidden border-4 border-surface shadow-sm mb-3 shrink-0">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                fill
                className="object-cover"
                sizes="80px"
              />
            ) : (
              initial
            )}
          </div>

          <h2 className="text-lg font-bold text-on-surface mb-0.5">
            {displayName}
          </h2>

          <p className="text-xs text-on-surface-variant mb-2">
            Opportunity Radar Member
          </p>

          {isLoading ? (
            <div className="flex flex-col items-center gap-2 mt-4 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              <span className="text-sm">Loading profile...</span>
            </div>
          ) : (
            <div className="w-full flex flex-col text-left mt-2 gap-4">
              {profile?.bio && (
                <div>
                  <h3 className="text-xs font-semibold text-on-surface mb-1 uppercase tracking-wider opacity-70">About</h3>
                  <p className="text-sm text-on-surface-variant leading-snug">
                    {profile.bio}
                  </p>
                </div>
              )}

              {(profile?.university || profile?.degree || profile?.graduation_year) && (
                <div>
                  <h3 className="text-xs font-semibold text-on-surface mb-1.5 uppercase tracking-wider opacity-70">Education</h3>
                  <div className="flex items-start gap-3 bg-surface-container-lowest p-2.5 rounded-xl border border-outline-variant/30">
                    <div className="w-8 h-8 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">school</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-[13px] text-on-surface leading-tight mt-0.5">
                        {profile.university || 'University'}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        {profile.degree || 'Student'} {profile.graduation_year ? `• Class of ${profile.graduation_year}` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {profile?.skills && profile.skills.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-on-surface mb-1.5 uppercase tracking-wider opacity-70">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((skill: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-surface-container rounded-full text-xs font-medium text-on-surface">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profile?.achievements && profile.achievements.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-on-surface mb-1.5 uppercase tracking-wider opacity-70">Projects & Certifications</h3>
                  <div className="flex flex-col gap-2">
                    {profile.achievements.map((achievement) => (
                      <div key={achievement.id} className="flex flex-col bg-surface-container-lowest p-2.5 rounded-xl border border-outline-variant/30">
                        <div className="flex justify-between items-start mb-0.5">
                          <span className="font-medium text-[13px] leading-tight text-on-surface">{achievement.title}</span>
                          {achievement.credential_url && (
                            <a href={achievement.credential_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-[10px] flex items-center gap-0.5">
                              Link <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                            </a>
                          )}
                        </div>
                        <span className="text-[11px] text-on-surface-variant">
                          {achievement.organization} {achievement.date_year ? `• ${achievement.date_year}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 w-full mt-5 shrink-0">
            {/* The PRD specifically mentions email, linkedin, skills, education, bio, etc. */}
            
            {(profile?.email || sender.email) && (
              <a
                href={`mailto:${profile?.email || sender.email}`}
                className="flex items-center justify-center gap-1.5 w-full py-2 px-4 bg-surface-container rounded-xl text-on-surface text-sm font-medium hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">mail</span>
                Email
              </a>
            )}

            {linkedinUrl && (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2 px-4 bg-[#0077b5] text-white text-sm rounded-xl font-medium hover:bg-[#006396] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">link</span>
                LinkedIn Profile
              </a>
            )}

            {githubUrl && (
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2 px-4 bg-[#24292e] text-white text-sm rounded-xl font-medium hover:bg-[#1b1f23] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">code</span>
                GitHub Profile
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
