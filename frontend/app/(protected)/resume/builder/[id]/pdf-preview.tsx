'use client'

import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer'
import { ResumeDocument } from '@/lib/resume-toolkit/pdf/document'
import type { ResumeData } from '@/lib/resume-toolkit/schema/resume/data'

export default function PdfPreview({ data }: { data: ResumeData }) {
  // Extract template, default to 'onyx' if undefined
  const templateName = data.metadata?.template || 'onyx'

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex justify-between items-center px-4 py-3 border-b border-outline-variant/30 bg-surface-container-lowest">
        <h3 className="font-bold text-label-md text-on-background">Live Preview</h3>
        <PDFDownloadLink
          document={<ResumeDocument data={data} template={templateName as any} />}
          fileName={`${data.basics?.name?.replace(/\s+/g, '_') || 'resume'}.pdf`}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-label-sm font-bold hover:bg-primary/90 transition-colors"
        >
          {/* Using a function child to render state-dependent UI */}
          {({ loading }: { loading: boolean }) => (
            <>
              <span className="material-symbols-outlined text-[18px]">
                {loading ? 'hourglass_empty' : 'download'}
              </span>
              {loading ? 'Preparing PDF...' : 'Download PDF'}
            </>
          )}
        </PDFDownloadLink>
      </div>
      <div className="flex-1 w-full bg-surface-container-highest">
        {/* PDFViewer takes up the remaining space */}
        <PDFViewer width="100%" height="100%" className="border-none">
          <ResumeDocument data={data} template={templateName as any} />
        </PDFViewer>
      </div>
    </div>
  )
}
