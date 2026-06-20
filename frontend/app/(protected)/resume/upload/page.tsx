'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ResumeUploadPage() {
  const router = useRouter()
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles && droppedFiles.length > 0) {
      validateAndSetFile(droppedFiles[0])
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const validateAndSetFile = (selectedFile: File) => {
    setError(null)
    if (selectedFile.type !== 'application/pdf') {
      setError('Please upload a PDF file.')
      return
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB.')
      return
    }
    setFile(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      if (data.success && data.resume_id) {
        router.push(`/resume/review?resume_id=${data.resume_id}`)
      } else {
        throw new Error('Upload succeeded but no resume ID returned.')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'An unexpected error occurred during upload.')
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-lg">
      <div className="mb-md">
        <Link href="/resume" className="flex items-center gap-2 text-primary hover:underline text-sm font-medium mb-4">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Toolkit
        </Link>
        <h1 className="font-headline-lg text-on-background mb-xs font-bold">Upload Your Resume</h1>
        <p className="text-on-surface-variant font-body-md">
          Upload your latest resume in PDF format. We&apos;ll parse it automatically.
        </p>
      </div>

      <div 
        className={`border-2 border-dashed rounded-3xl p-xl flex flex-col items-center justify-center transition-colors min-h-[300px] ${
          isDragging ? 'border-primary bg-primary-container/10' : 'border-outline-variant bg-surface'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          accept="application/pdf"
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileChange}
        />

        <div className="w-16 h-16 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center mb-md">
          <span className="material-symbols-outlined text-3xl">upload_file</span>
        </div>

        {file ? (
          <div className="text-center">
            <p className="font-label-lg font-bold text-on-background mb-1">{file.name}</p>
            <p className="text-on-surface-variant text-sm mb-lg">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => setFile(null)}
                className="px-4 py-2 border border-outline rounded-xl font-label-md hover:bg-surface-container transition-colors"
                disabled={isUploading}
              >
                Remove
              </button>
              <button 
                onClick={handleUpload}
                className="px-6 py-2 bg-primary text-on-primary rounded-xl font-label-md font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Processing...
                  </>
                ) : 'Confirm Upload'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <h3 className="font-label-lg font-bold text-on-background mb-2">Drag and drop your PDF here</h3>
            <p className="text-on-surface-variant text-sm mb-lg">Max file size: 5MB</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2 bg-surface-container-high text-on-surface rounded-xl border border-outline-variant hover:bg-surface-container-highest transition-colors font-label-md font-medium"
            >
              Browse Files
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-md p-md bg-error-container text-on-error-container rounded-xl flex items-center gap-sm">
          <span className="material-symbols-outlined">error</span>
          <p className="font-label-md">{error}</p>
        </div>
      )}
    </div>
  )
}
