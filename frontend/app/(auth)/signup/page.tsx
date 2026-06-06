import { Suspense } from 'react'
import { SignupForm } from '@/features/auth/components/signup-form'

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <Suspense fallback={<div>Loading...</div>}>
        <SignupForm />
      </Suspense>
    </div>
  )
}
