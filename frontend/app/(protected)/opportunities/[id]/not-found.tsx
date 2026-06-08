import Link from 'next/link'

export default function OpportunityNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <span className="material-symbols-outlined text-[64px] text-on-surface-variant/50 mb-4">
        search_off
      </span>
      <h2 className="text-2xl font-bold text-on-background mb-2">Opportunity Not Found</h2>
      <p className="text-on-surface-variant mb-8 max-w-[448px]">
        The opportunity you are looking for does not exist, has been removed, or you do not have permission to view it.
      </p>
      <Link
        href="/search"
        className="px-6 py-3 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 transition-colors shadow-sm"
      >
        Back to Search
      </Link>
    </div>
  )
}
