import { redirect } from 'next/navigation'

export default function HubPage() {
  // For MVP, Hub redirects directly to Search.
  redirect('/search')
}
