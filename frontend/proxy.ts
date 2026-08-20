import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isProtectedRoute, isAuthRoute } from '@/lib/auth/protected-routes'

export async function proxy(request: NextRequest) {
  // Bypass completely for the auth callback route to prevent
  // supabase.auth.getUser() from prematurely consuming the PKCE code.
  if (request.nextUrl.pathname.startsWith('/auth/callback')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined.'
    )
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()

  // Redirect unauthenticated users away from protected routes, preserving
  // where they were headed so login can send them back.
  if (isProtectedRoute(url.pathname) && !user) {
    const intendedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`

    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', intendedPath)

    const redirectResponse = NextResponse.redirect(url)

    // Carry over any refreshed/cleared auth cookies so the session state
    // written by getUser() is not lost on the redirect.
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })

    return redirectResponse
  }

  // Redirect authenticated users away from auth routes to dashboard
  if (isAuthRoute(url.pathname) && user) {
    url.pathname = '/dashboard'
    url.searchParams.delete('next')
    url.searchParams.delete('error')
    const redirectResponse = NextResponse.redirect(url)

    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })

    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
