// CANONICAL: FamComply request middleware. Single source of truth for route
// protection and Supabase session refresh across the whole app.
//
// Required environment variables (set on Netlify, values live in zo_config):
//   NEXT_PUBLIC_SUPABASE_URL       -> zo_config.supabase_url       (client safe)
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  -> zo_config.supabase_anon_key  (client safe)
//
// Cookie security: @supabase/ssr issues the auth cookies with HttpOnly,
// Secure (in production) and SameSite=Lax. We never hand-roll auth cookies.
//
// Rate limiting note: Supabase GoTrue applies its own limits to sign in,
// sign up and password reset. Add an edge/proxy rate limit (for example
// 10 requests per minute per user) on /api/checkout and /api/billing/*.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// These API paths authenticate themselves with their own shared secret
// (the daily cron checks CRON_SECRET). Session cookies do not apply to them,
// so gating them on a browser session would break the scheduler.
const SELF_AUTHENTICATED_API = ['/api/cron', '/api/webhooks']

// Read-only catalog endpoints that are intentionally public (GET only).
// /api/plans serves the active pricing catalog and holds no user data.
const PUBLIC_API_GET = ['/api/plans']

// Signed-out visitors get bounced from these page prefixes to /login.
// All four (dashboard) group pages are listed for defense in depth: the group
// layout also checks auth server-side, but listing them here preserves the
// ?next= return-to flow and keeps protection independent of any one layer.
const PROTECTED_PAGES = ['/dashboard', '/reminders', '/settings', '/billing']

// Signed-in users get bounced from these pages to /dashboard.
// /reset-password is intentionally NOT here: recovery links sign the user in
// first, and they still need to reach that page to set the new password.
const AUTH_PAGES = ['/login', '/signup', '/forgot-password']

// Open-redirect protection: only same-origin paths are allowed as a target.
function safeNext(pathAndQuery: string): string {
  if (pathAndQuery.startsWith('/') && !pathAndQuery.startsWith('//')) return pathAndQuery
  return '/dashboard'
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (SELF_AUTHENTICATED_API.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  let response = NextResponse.next({ request })
  let user = null

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    })

    // getUser() validates the JWT against Supabase on every request.
    // Never trust getSession() alone for protection decisions.
    const { data } = await supabase.auth.getUser()
    user = data.user
  } else {
    // Fail closed: with no configuration we treat everyone as signed out,
    // so protected pages and APIs stay locked instead of leaking.
    console.error('middleware: Supabase env vars missing; treating request as signed out')
  }

  const isApi = pathname.startsWith('/api')
  const isProtectedPage = PROTECTED_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'))
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (!user && isApi) {
    // Public read-only catalog data (GET only) stays reachable signed out.
    const isPublicApi =
      request.method === 'GET' &&
      PUBLIC_API_GET.some((p) => pathname === p || pathname.startsWith(p + '/'))
    if (isPublicApi) {
      return response
    }
    // Link-based browser flows (GET /api/checkout, GET /api/billing/portal)
    // get a login redirect that brings them straight back afterwards.
    // Every other unauthenticated API call gets a clean JSON 401.
    const isBrowserBillingLink =
      request.method === 'GET' &&
      (pathname.startsWith('/api/checkout') || pathname.startsWith('/api/billing/portal'))
    if (isBrowserBillingLink) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      url.searchParams.set('next', safeNext(pathname + search))
      return NextResponse.redirect(url)
    }
    return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })
  }

  if (!user && isProtectedPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', safeNext(pathname + search))
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff|woff2)$).*)',
  ],
}
