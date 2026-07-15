// CANONICAL: sign-out endpoint. POST-only so a cross-site GET can never log
// someone out (logout CSRF). Clears the Supabase session cookies and sends
// the user back to the home page.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true // non-browser clients and same-origin form posts
  try {
    return new URL(origin).host === (request.headers.get('host') ?? request.nextUrl.host)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'That request came from somewhere unexpected, so we stopped it.' },
      { status: 403 }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    const cookieStore = cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    })
    await supabase.auth.signOut()
  }

  return NextResponse.redirect(new URL('/', request.url), { status: 303 })
}

export async function GET() {
  return NextResponse.json(
    { error: 'Use a POST request to sign out.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
