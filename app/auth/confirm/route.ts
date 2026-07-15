// CANONICAL: email confirmation and recovery link handler at /auth/confirm.
//
// Supabase email templates should point here (Deploy Mind sets this up):
//   Confirm signup: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard
//   Reset password: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
// Supabase Auth settings (per product):
//   Site URL:      https://famcomply.zeroorigine.com
//   Redirect URLs: https://famcomply.zeroorigine.com/** and http://localhost:3000/**

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

function safeNext(value: string | null, fallback: string): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  return fallback
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  let next = safeNext(searchParams.get('next'), '/dashboard')
  if (type === 'recovery') next = '/reset-password'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (tokenHash && type && supabaseUrl && supabaseAnonKey) {
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

    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('message', 'That link expired or was already used. Sign in, or request a fresh link.')
  return NextResponse.redirect(loginUrl)
}
