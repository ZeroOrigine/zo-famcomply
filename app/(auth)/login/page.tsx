'use client'

// CANONICAL: FamComply login page. Email + password and OAuth sign in.
// Shared card/input/button styles, Spinner, and CardSkeleton come from
// components/auth/auth-ui (one definition across all auth pages).
// CSRF note: Supabase JS sends credentials in a fetch body (not a form post)
// and the session cookies are SameSite=Lax, which blocks cross-site posts.

import { Suspense, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BTN_OAUTH,
  BTN_PRIMARY,
  CARD,
  CardSkeleton,
  INPUT,
  LABEL,
  Spinner,
  getAuthSupabase,
} from '@/components/auth/auth-ui'

// #100: a descendant reads URL search params (useSearchParams); opt this
// route out of static generation so `next build` does not CSR-bail.
export const dynamic = 'force-dynamic';

function friendlyAuthError(raw: string): string {
  const msg = raw.toLowerCase()
  if (msg.includes('invalid login credentials')) {
    return "That email and password don't match our records. Check them and try again, or reset your password below."
  }
  if (msg.includes('email not confirmed')) {
    return "Your email isn't confirmed yet. Open the link we sent you, then sign in."
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Too many tries in a row. Give it a minute, then try again.'
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return "We couldn't reach the server. Check your connection and try again."
  }
  return "That didn't go through on our side. Give it one more try."
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.26-2.09 3.56-5.17 3.56-8.86Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.92.43.38.82 1.11.82 2.24v3.32c0 .32.21.7.82.58A12 12 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'
  const infoMessage = searchParams.get('message')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter your email and password to sign in.')
      return
    }
    setLoading(true)
    const supabase = getAuthSupabase()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (signInError) {
      setError(friendlyAuthError(signInError.message))
      setLoading(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  async function handleOAuth(provider: 'google' | 'github') {
    setError(null)
    setOauthLoading(provider)
    const supabase = getAuthSupabase()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (oauthError) {
      setError(friendlyAuthError(oauthError.message))
      setOauthLoading(null)
    }
  }

  return (
    <div className={CARD}>
      <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
      <p className="mt-1.5 text-sm text-slate-600">{"Sign in to check what's coming up next on your timeline."}</p>

      {infoMessage && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800" role="status">
          {infoMessage}
        </div>
      )}

      <div className="mt-6 space-y-2.5">
        <button type="button" className={BTN_OAUTH} onClick={() => handleOAuth('google')} disabled={loading || oauthLoading !== null}>
          {oauthLoading === 'google' ? <Spinner /> : <GoogleIcon />}
          Continue with Google
        </button>
        <button type="button" className={BTN_OAUTH} onClick={() => handleOAuth('github')} disabled={loading || oauthLoading !== null}>
          {oauthLoading === 'github' ? <Spinner /> : <GitHubIcon />}
          Continue with GitHub
        </button>
      </div>

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">or with your email</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="email" className={LABEL}>Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
            placeholder="you@example.com"
          />
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
            <Link href="/forgot-password" className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${INPUT} pr-16`}
              placeholder="Your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute inset-y-0 right-0 min-w-[44px] px-3.5 text-xs font-semibold text-slate-500 transition hover:text-emerald-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className={`${BTN_PRIMARY} mt-5`} disabled={loading || oauthLoading !== null}>
          {loading && <Spinner />}
          {loading ? 'Signing you in...' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        New to FamComply?{' '}
        <Link href="/signup" className="font-semibold text-emerald-700 transition hover:text-emerald-800">
          Create your account
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <LoginForm />
    </Suspense>
  )
}
