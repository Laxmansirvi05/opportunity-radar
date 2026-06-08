'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SettingsTogglesProps {
  initialEmailAlerts: boolean
  initialPublicProfile: boolean
}

export function SettingsToggles({ initialEmailAlerts, initialPublicProfile }: SettingsTogglesProps) {
  const [emailAlerts, setEmailAlerts] = useState(initialEmailAlerts)
  const [publicProfile, setPublicProfile] = useState(initialPublicProfile)
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const handleToggle = async (type: 'email' | 'public', currentValue: boolean) => {
    setIsLoading(true)
    const newValue = !currentValue
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const updates = type === 'email' 
        ? { email_alerts: newValue }
        : { public_profile: newValue }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (error) throw error

      if (type === 'email') setEmailAlerts(newValue)
      if (type === 'public') setPublicProfile(newValue)
      
    } catch (err) {
      console.error('Failed to update settings:', err)
      // Optionally show a toast error here
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between p-4 bg-surface-container-lowest border border-outline-variant/50 rounded-xl">
        <div>
          <h4 className="font-bold text-on-background">Email Alerts</h4>
          <p className="text-sm text-on-surface-variant">Receive weekly opportunity matches.</p>
        </div>
        <button 
          onClick={() => handleToggle('email', emailAlerts)}
          disabled={isLoading}
          className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer disabled:opacity-50 ${emailAlerts ? 'bg-primary' : 'bg-surface-container-high'}`}
          aria-label="Toggle Email Alerts"
        >
          <div className={`w-4 h-4 rounded-full absolute top-1 transition-all ${emailAlerts ? 'bg-white right-1' : 'bg-on-surface-variant left-1'}`}></div>
        </button>
      </div>

      <div className="flex items-center justify-between p-4 bg-surface-container-lowest border border-outline-variant/50 rounded-xl">
        <div>
          <h4 className="font-bold text-on-background">Public Profile</h4>
          <p className="text-sm text-on-surface-variant">Allow recruiters to view your resume.</p>
        </div>
        <button 
          onClick={() => handleToggle('public', publicProfile)}
          disabled={isLoading}
          className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer disabled:opacity-50 ${publicProfile ? 'bg-primary' : 'bg-surface-container-high'}`}
          aria-label="Toggle Public Profile"
        >
          <div className={`w-4 h-4 rounded-full absolute top-1 transition-all ${publicProfile ? 'bg-white right-1' : 'bg-on-surface-variant left-1'}`}></div>
        </button>
      </div>
    </div>
  )
}
