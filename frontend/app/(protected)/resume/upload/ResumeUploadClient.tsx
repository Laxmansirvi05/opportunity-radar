'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createResume } from '@/features/resume-toolkit/services/resume-actions'
import type { ResumeData } from '@reactive-resume/schema/resume/data'

type UploadStep = 'idle' | 'uploading' | 'extracting' | 'creating' | 'done' | 'error'

const STEP_LABELS: Record<UploadStep, string> = {
  idle: 'Select a PDF or resume image to begin',
  uploading: 'Uploading file…',
  extracting: 'AI is extracting your resume — this may take a moment…',
  creating: 'Creating editable resume…',
  done: 'Done! Redirecting to builder…',
  error: 'Something went wrong. Please try again.',
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

export default function ResumeUploadClient() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<UploadStep>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Upload a PDF, PNG, JPEG, or WebP resume.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5 MB.')
      return
    }

    setSelectedFile(file)
    setStep('idle')
    setErrorMsg(null)
  }, [])

  const handleExtract = useCallback(async () => {
    if (!selectedFile) return

    setErrorMsg(null)

    try {
      // 1. Upload & Parse
      setStep('uploading')
      const formData = new FormData()
      formData.append('file', selectedFile)

      setStep('extracting')
      const parseRes = await fetch('/api/resume/parse', {
        method: 'POST',
        body: formData,
      })

      if (!parseRes.ok) {
        const errBody = await parseRes.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errBody.error || `Parse failed (${parseRes.status})`)
      }

      const resumeData: ResumeData = await parseRes.json()

      // 2. Create resume in DB
      setStep('creating')
      const title = selectedFile.name.replace(/\.[^.]+$/i, '') || 'Imported Resume'
      const result = await createResume(title, resumeData)

      if (!result.success) {
        throw new Error(result.error || 'Failed to save resume')
      }

      // 3. Redirect to builder
      setStep('done')
      toast.success('Resume imported successfully!')
      router.push(`/resume/builder/${result.id}`)
    } catch (err: unknown) {
      console.error('[Upload] Error:', err)
      setStep('error')
      setErrorMsg(errorMessage(err))
      toast.error(errorMessage(err))
    }
  }, [selectedFile, router])

  const isProcessing = step === 'uploading' || step === 'extracting' || step === 'creating'

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', gap: '32px',
      minHeight: '60vh',
    }}>
      {/* Upload Area */}
      <div
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        style={{
          width: '100%', maxWidth: '520px',
          border: '2px dashed #CBD5E0',
          borderRadius: '16px', padding: '48px 32px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          backgroundColor: selectedFile ? '#F0FFF4' : '#FAFBFC',
          opacity: isProcessing ? 0.6 : 1,
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          backgroundColor: selectedFile ? '#C6F6D5' : '#EDF2F7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="material-symbols-outlined" style={{
            fontSize: '28px',
            color: selectedFile ? '#22543D' : '#718096',
          }}>
            {selectedFile ? 'description' : 'cloud_upload'}
          </span>
        </div>

        {selectedFile ? (
          <>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#22543D' }}>
              {selectedFile.name}
            </span>
            <span style={{ fontSize: '13px', color: '#718096' }}>
              {(selectedFile.size / 1024).toFixed(0)} KB — Click to change file
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#2D3748' }}>
              Drop your resume here or click to browse
            </span>
            <span style={{ fontSize: '13px', color: '#718096' }}>
              Supports PDF, PNG, JPEG, and WebP files up to 5 MB
            </span>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Status */}
      {step !== 'idle' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 20px', borderRadius: '10px',
          backgroundColor: step === 'error' ? '#FFF5F5' : '#EBF8FF',
          color: step === 'error' ? '#C53030' : '#2B6CB0',
          fontSize: '14px', fontWeight: 500,
          maxWidth: '520px', width: '100%',
        }}>
          {isProcessing && (
            <span style={{
              display: 'inline-block', width: '16px', height: '16px',
              border: '2px solid currentColor', borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          )}
          {step === 'error' && (
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
          )}
          {step === 'done' && (
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#38A169' }}>check_circle</span>
          )}
          <span>{errorMsg || STEP_LABELS[step]}</span>
        </div>
      )}

      {/* Extract Button */}
      <button
        onClick={handleExtract}
        disabled={!selectedFile || isProcessing}
        style={{
          padding: '12px 32px', borderRadius: '10px', border: 'none',
          fontSize: '15px', fontWeight: 600, cursor: 'pointer',
          backgroundColor: !selectedFile || isProcessing ? '#CBD5E0' : '#4F46E5',
          color: !selectedFile || isProcessing ? '#A0AEC0' : '#FFFFFF',
          transition: 'all 0.2s ease',
          maxWidth: '520px', width: '100%',
        }}
      >
        {isProcessing ? 'Processing…' : 'Extract & Edit'}
      </button>

      {/* Keyframes for spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
