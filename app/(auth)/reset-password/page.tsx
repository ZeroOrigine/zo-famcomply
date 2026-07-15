'use client'

// CANONICAL: FamComply reset-password page. The recovery link signs the user
// in (via /auth/callback or /auth/confirm), then this page sets the new
// password with supabase.auth.updateUser.
// Shared styles, Spinner, and CardSkeleton come from components/auth/auth-ui.

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BTN_PRIMARY,
  CARD,
  CardSkeleton,
  INPUT,
  LABEL,
  Spinner,
  getAuthSupabase,
} from '@/components/auth/auth-ui'

type Status = 'checking' | 'ready' | 'invalid' | 'done'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getAuthSupabase()
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) {
        setStatus((s) => (s === 'checking' ? 'ready' : s))
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) {
        setStatus((s) => (s === 'checking' ? 'ready' : s))
      }
    })

    const timer = setTimeout(() => {
      setStatus((s) => (s === 'checking' ? 'invalid' : s))
    }, 2500)

    return () => {
      active = false
      listener.subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Your new password needs at least 8 characters. A short phrase works well.')
      return
    }
    setSaving(true)
    const supabase = getAuthSupabase()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      const msg = updateError.message.toLowerCase()
      if (msg.includes('different from the old')) {
        setError('That matches your old password. Pick something new.')
      } else if (msg.includes('session') || msg.includes('not logged in')) {
        setStatus('invalid')
      } else {
        setError("That didn't go through on our side. Give it one more try.")
      }
      setSaving(false)
      return
    }
    setStatus('done')
    setTimeout(() => {
      router.push('/dashboard')
      router.refresh()
    }, 1400)
  }

  if (status === 'checking') {
    return <CardSkeleton />
  }

  if (status === 'invalid') {
    return (
      <div className={CARD}>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">This link has expired</h1>
        <p className="mt-2 text-sm text-slate-600">
          Password reset links only work for a little while. Request a fresh one and try again.
        </p>
        <Link href="/forgot-password" className={`${BTN_PRIMARY} mt-6`}>
          Send me a new link
        </Link>
        <p className="mt-5 text-center text-sm text-slate-600">
          <Link href="/login" className="font-semibold text-emerald-700 transition hover:text-emerald-800">Back to sign in</Link>
        </p>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className={CARD}>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-7 w-7 text-emerald-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-5 text-center font-display text-2xl font-bold tracking-tight text-slate-900">Password updated</h1>
        <p className="mt-2 text-center text-sm text-slate-600">{"You're set. Taking you to your timeline now."}</p>
        <p className="mt-5 text-center text-sm">
          <Link href="/dashboard" className="font-semibold text-emerald-700 transition hover:text-emerald-800">Go to dashboard</Link>
        </p>
      </div>
    )
  }

  return (
    <div className={CARD}>
      <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-slate-600">Pick something memorable. You stay signed in after saving.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6">
        <label htmlFor="password" className={LABEL}>New password</label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${INPUT} pr-16`}
            placeholder="At least 8 characters"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute inset-y-0 right-0 px-3.5 text-xs font-semibold text-slate-500 transition hover:text-emerald-700"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className={`${BTN_PRIMARY} mt-5`} disabled={saving}>
          {saving && <Spinner />}
          {saving ? 'Saving...' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
