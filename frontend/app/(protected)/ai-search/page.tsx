import { AiSearchClient } from '@/features/ai-search/components/ai-search-client'

export const metadata = {
  title: 'AI Search | Opportunity Radar',
  description: 'Upload your resume and get opportunities matched and scored against it.',
}

export default function AiSearchPage() {
  return <AiSearchClient />
}
