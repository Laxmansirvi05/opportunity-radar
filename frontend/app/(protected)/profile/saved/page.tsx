import { createClient } from '@/lib/supabase/server'
import { OpportunitySearchCard } from '@/features/opportunities/components/search/opportunity-search-card'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata = {
  title: 'Saved Opportunities | Opportunity Radar'
}

export default async function SavedOpportunitiesPage() {
  const supabase = await createClient()
  const [
    { data: { user } }
  ] = await Promise.all([
    supabase.auth.getUser()
  ])

  if (!user) {
    return notFound()
  }

  // Fetch bookmarks with joined opportunities and companies
  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select(`
      id,
      opportunities (
        id, title, location, category, mode, experience_level, is_paid, status, posted_at, deadline, company_id, apply_url, description,
        companies (id, name, logo_url, website_url),
        opportunity_tags (tag_name)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const savedOpportunities = bookmarks?.map((b: any) => b.opportunities).filter(Boolean) || []

  return (
    <div className="max-w-container-max mx-auto space-y-lg pb-16">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/profile"
          className="p-2 hover:bg-surface-variant rounded-full transition-colors material-symbols-outlined text-on-surface-variant"
        >
          arrow_back
        </Link>
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Saved Opportunities</h1>
          <p className="font-body-md text-on-surface-variant mt-1">
            {savedOpportunities.length} {savedOpportunities.length === 1 ? 'opportunity' : 'opportunities'} saved for later
          </p>
        </div>
      </div>

      {savedOpportunities.length === 0 ? (
        <div className="bg-surface-container-lowest border border-dashed border-outline-variant rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-outline text-[48px] mb-4">bookmark_border</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-2">No saved opportunities</h2>
          <p className="font-body-md text-on-surface-variant max-w-[448px]">
            You haven't saved any opportunities yet. When you see something interesting, click the bookmark icon to save it here for later.
          </p>
          <Link
            href="/search"
            className="mt-6 bg-primary text-on-primary px-6 py-2.5 rounded-full font-label-md text-label-md hover:bg-surface-tint transition-colors cursor-pointer"
          >
            Explore Opportunities
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedOpportunities.map((opportunity) => (
            <OpportunitySearchCard
              key={opportunity.id}
              opportunity={opportunity as any}
            />
          ))}
        </div>
      )}
    </div>
  )
}
