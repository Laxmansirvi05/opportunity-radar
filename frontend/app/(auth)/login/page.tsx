import { Suspense } from 'react'
import { AuthExperience } from '@/features/auth/components/auth-experience'

export const metadata = {
  title: 'Log In | Opportunity Radar',
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthExperience />
    </Suspense>
  )
}
