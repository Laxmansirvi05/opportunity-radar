import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract & Edit | Resume Toolkit',
}

export default function UploadPage() {
  return (
    <div className="flex-1 flex flex-col h-full bg-surface p-8">
      <h1 className="text-3xl font-bold text-on-background mb-4">Extract & Edit</h1>
      <p className="text-on-surface-variant">
        Upload your existing resume (PDF or DOCX) to automatically extract the content into the builder.
      </p>
    </div>
  )
}
