import { Metadata } from 'next'
import ResumeUploadClient from './ResumeUploadClient'

export const metadata: Metadata = {
  title: 'Extract & Edit | Resume Toolkit',
}

export default function UploadPage() {
  return (
    <div className="flex-1 flex flex-col h-full bg-surface p-8">
      <h1 className="text-3xl font-bold text-on-background mb-2">Extract & Edit</h1>
      <p className="text-on-surface-variant mb-6">
        Upload your existing resume (PDF) to automatically extract the content into the builder.
      </p>
      <ResumeUploadClient />
    </div>
  )
}
