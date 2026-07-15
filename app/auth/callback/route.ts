// CANONICAL: OAuth and PKCE code exchange handler at /auth/callback.
// Google and GitHub sign-ins land here, as do confirmation emails that use
// the default Supabase {{ .ConfirmationURL }} template. Exchanges the code
// for a session cookie, then sends the user on to their destination.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

function safeNext(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  return '/dashboard'
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error_description') || searchParams.get('error')
  const next = safeNext(searchParams.get('next'))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (code && supabaseUrl && supabaseAnonKey) {
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

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set(
    'message',
    oauthError
      ? 'Sign in was canceled before it finished. Try again whenever you are ready.'
      : 'That sign-in link expired or was already used. Sign in, or request a fresh one.'
  )
  return NextResponse.redirect(loginUrl)
}
