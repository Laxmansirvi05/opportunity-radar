import { createClient } from '@/lib/supabase/server'
import { TrackerBoard } from '@/features/tracker/components/tracker-board'

export default async function TrackerPage() {
  const supabase = await createClient()

  // Fetch the user's tracker items
  const { data: trackerData, error } = await supabase
    .from('application_tracker')
    .select(`
      id,
      status,
      saved_at,
      applied_at,
      opportunities (
        id,
        title,
        location,
        mode,
        companies (
          id,
          name,
          logo_url
        )
      )
    `)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching tracker data:', error)
  }

  // Sanitize data structure
  const formattedData = (trackerData || []).map((item: any) => ({
    id: item.id,
    status: item.status,
    saved_at: item.saved_at,
    applied_at: item.applied_at,
    opportunity_id: item.opportunities?.id,
    title: item.opportunities?.title || 'Unknown Title',
    location: item.opportunities?.location,
    mode: item.opportunities?.mode,
    company_name: item.opportunities?.companies?.name || 'Unknown Company',
    company_logo: item.opportunities?.companies?.logo_url,
  }))

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-container-lowest overflow-hidden">
      <div className="p-4 md:p-8 border-b border-outline-variant bg-surface shrink-0">
        <h1 className="text-2xl md:text-3xl font-bold text-on-background">Application Tracker</h1>
        <p className="text-sm text-on-surface-variant mt-1">Manage and track your opportunity pipeline.</p>
      </div>
      
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4 md:p-8">
        <TrackerBoard initialData={formattedData} />
      </div>
    </div>
  )
}
