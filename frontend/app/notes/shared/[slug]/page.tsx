import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { sanitizeNoteContent } from '@/features/notes/lib/sanitize-note-content'

export const runtime = 'nodejs'
// Never cached: revoking a share has to take effect immediately, and a cached
// copy of a note that is no longer shared is exactly the leak this page must
// not have.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Shared note | Opportunity Radar',
  // A shared link is unlisted, not public — it should not turn up in search.
  robots: { index: false, follow: false },
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * The read-only page behind "anyone with the link can view".
 *
 * Deliberately unauthenticated, and therefore deliberately narrow: it reads
 * with the service-role key but only ever resolves a note through a
 * note_shares row whose link_access is still 'view', and returns only the
 * title, body and dates — never the owner, the folder, tags, or any other
 * note. A revoked share stops resolving on the very next request.
 *
 * The content is re-sanitised on the way out rather than trusted from
 * storage: this is the one place note HTML is rendered to someone who is not
 * signed in, so it does not rely on the write path having been the only way
 * the row could have been populated.
 */
export default async function SharedNotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: share } = await admin
    .from('note_shares')
    .select('note_id, link_access')
    .eq('slug', slug)
    .maybeSingle()

  if (!share || share.link_access !== 'view') notFound()

  const { data: note } = await admin
    .from('notes')
    .select('title, content, created_at, updated_at, deleted_at')
    .eq('id', share.note_id as string)
    .maybeSingle()

  // A trashed note stops being reachable by link, without the owner having to
  // remember to revoke the share first.
  if (!note || note.deleted_at) notFound()

  const updated = new Date(note.updated_at as string)
  const updatedLabel = `${MONTHS[updated.getUTCMonth()]} ${updated.getUTCDate()}, ${updated.getUTCFullYear()}`

  return (
    <main className="min-h-dvh bg-surface">
      <header className="border-b border-outline-variant">
        <div className="mx-auto max-w-3xl px-5 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="font-title-sm text-title-sm text-primary font-bold">Opportunity Radar</Link>
          <span className="font-label-sm text-label-sm text-on-surface-variant">Shared note · view only</span>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="font-headline-sm text-headline-sm text-on-surface">
          {(note.title as string) || 'Untitled'}
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 mb-6">
          Last updated {updatedLabel}
        </p>

        <div
          className="note-document text-on-surface"
          // Re-sanitised immediately above with the same allowlist the write
          // path uses; nothing else on this page renders user content.
          dangerouslySetInnerHTML={{ __html: sanitizeNoteContent((note.content as string) ?? '') }}
        />
      </article>

      <footer className="mx-auto max-w-3xl px-5 pb-10">
        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 text-center">
          <p className="font-body-md text-body-md text-on-surface-variant">
            Shared from Opportunity Radar — find internships, hackathons and scholarships, and keep your own notes on them.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center mt-3 h-10 px-4 rounded-full bg-primary text-on-primary font-label-lg text-label-lg"
          >
            Create a free account
          </Link>
        </div>
      </footer>
    </main>
  )
}
