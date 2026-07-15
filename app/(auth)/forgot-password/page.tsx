'use client'

// CANONICAL: FamComply forgot-password page. Sends the Supabase recovery email.
// The response copy is identical whether or not the account exists, so this
// page never confirms which emails have accounts.
// Shared styles and Spinner come from components/auth/auth-ui.

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { BTN_PRIMARY, CARD, INPUT, LABEL, Spinner, getAuthSupabase } from '@/components/auth/auth-ui'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Enter the email you signed up with.')
      return
    }
    setLoading(true)
    const supabase = getAuthSupabase()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    if (resetError) {
      const msg = resetError.message.toLowerCase()
      if (msg.includes('rate limit') || msg.includes('too many')) {
        setError('Too many requests in a row. Give it a minute, then try again.')
      } else {
        setError("That didn't go through on our side. Give it one more try.")
      }
      setLoading(false)
      return
    }
    setSentTo(email.trim())
    setLoading(false)
  }

  if (sentTo) {
    return (
      <div className={CARD}>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-7 w-7 text-emerald-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 8l9 6 9-6M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-5 text-center font-display text-2xl font-bold tracking-tight text-slate-900">Check your inbox</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          If an account exists for <span className="font-semibold text-slate-900">{sentTo}</span>, a password reset link is on its way. It stays valid for about an hour.
        </p>
        <p className="mt-6 text-center text-sm text-slate-600">
          Remembered it after all?{' '}
          <Link href="/login" className="font-semibold text-emerald-700 transition hover:text-emerald-800">Back to sign in</Link>
        </p>
      </div>
    )
  }

  return (
    <div className={CARD}>
      <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Reset your password</h1>
      <p className="mt-1.5 text-sm text-slate-600">Enter your email and we send you a link to choose a new one.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6">
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

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className={`${BTN_PRIMARY} mt-5`} disabled={loading}>
          {loading && <Spinner />}
          {loading ? 'Sending your link...' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        <Link href="/login" className="font-semibold text-emerald-700 transition hover:text-emerald-800">Back to sign in</Link>
      </p>
    </div>
  )
}
