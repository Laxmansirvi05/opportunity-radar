import { Suspense } from 'react'
import { AuthExperience } from '@/features/auth/components/auth-experience'

export const metadata = {
  title: 'Sign Up | Opportunity Radar',
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <AuthExperience />
    </Suspense>
  )
}
