import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@/lib/types'

const ROLE_ROUTES: Record<UserRole, string> = {
  doctor: '/dashboard/doctor',
  admin: '/dashboard/admin',
  patient: '/dashboard/patient',
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must not run any code between createServerClient and getUser
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Unauthenticated users ────────────────────────────────
  if (!user) {
    if (
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/api/optimize')
    ) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    return supabaseResponse
  }

  // ── Authenticated: fetch role ────────────────────────────
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as UserRole | undefined

  if (!role) {
    // Profile not created yet — let them through
    return supabaseResponse
  }

  const correctDashboard = ROLE_ROUTES[role]

  // Redirect root to correct dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL(correctDashboard, request.url))
  }

  // Redirect from generic /dashboard to role-specific one
  if (pathname === '/dashboard') {
    return NextResponse.redirect(new URL(correctDashboard, request.url))
  }

  // Prevent cross-role access
  if (pathname.startsWith('/dashboard')) {
    const allowedPrefix = correctDashboard
    if (!pathname.startsWith(allowedPrefix)) {
      return NextResponse.redirect(new URL(correctDashboard, request.url))
    }
  }

  // Redirect away from auth pages if already logged in
  if (pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL(correctDashboard, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
