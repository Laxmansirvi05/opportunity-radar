import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Protected route prefixes — any route starting with these paths
 * requires an authenticated session. Matches the (protected) route group
 * from the TRD routing structure.
 */
const PROTECTED_ROUTES = [
  '/dashboard',
  '/profile',
  '/tracker',
  '/notifications',
  '/submit',
  '/hub',
  '/search',
  '/opportunities',
  '/settings',
  '/support',
]

/**
 * Auth route prefixes — authenticated users should be redirected
 * to /dashboard instead of seeing login/signup pages.
 */
const AUTH_ROUTES = [
  '/login',
  '/signup',
]

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

export async function middleware(request: NextRequest) {
  // Bypass middleware completely for the auth callback route
  // to prevent supabase.auth.getUser() from prematurely consuming the PKCE code
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

  // Redirect unauthenticated users away from protected routes
  if (isProtectedRoute(url.pathname) && !user) {
    url.pathname = '/login'
    url.searchParams.set('next', request.nextUrl.pathname)
    const redirectResponse = NextResponse.redirect(url)

    // Copy cookies from supabaseResponse to redirectResponse to persist session updates
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
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
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })

    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Temporarily exclude builder for puppeteer tests
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|resume/builder).*)",
  ],
}
