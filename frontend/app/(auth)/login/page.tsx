import { Suspense } from 'react'
import { LoginForm } from '@/features/auth/components/login-form'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
