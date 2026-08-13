import { redirect } from 'next/navigation'

// Placeholder while the real landing/hero page is redesigned from scratch.
// The previous version (components/landing/*, 19 files) was removed
// entirely rather than left dormant — see git history if any piece of it
// is worth referencing while planning the replacement.
export default function HomePage() {
  redirect('/login')
}
