import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = req.nextUrl

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/rapport') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/onboarding')

  if (isProtected && !session) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // Admin plan bypass is handled at the API/page level via isAdmin flag from /api/me
  // (checking is_admin in middleware would require a service-role DB call on every request)

  return res
}

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/rapport/:path*',
    '/pricing',
    '/pricing/:path*',
    '/onboarding',
    '/onboarding/:path*',
  ],
}
