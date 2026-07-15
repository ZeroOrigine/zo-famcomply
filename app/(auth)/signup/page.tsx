'use client'

// CANONICAL: FamComply signup page. Creates the account and passes state and
// license type into Supabase user metadata. The famcomply_handle_new_user
// database trigger reads that metadata to prebuild the provider profile, so
// the renewal timeline can be generated the moment the dashboard loads.
// Supports ?state=CA&license=family_child_care prefill from the landing page.
// Shared styles, Spinner, and CardSkeleton come from components/auth/auth-ui.

import { Suspense, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD_WIDE,
  CardSkeleton,
  INPUT,
  LABEL,
  Spinner,
  getAuthSupabase,
} from '@/components/auth/auth-ui'

// #100: a descendant reads URL search params (useSearchParams); opt this
// route out of static generation so `next build` does not CSR-bail.
export const dynamic = 'force-dynamic';

const US_STATES: ReadonlyArray<[string, string]> = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'],
  ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'],
  ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
  ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'],
  ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
]

const LICENSE_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'family_child_care', label: 'Family child care' },
  { value: 'group_family_child_care', label: 'Group family child care' },
  { value: 'large_family_child_care', label: 'Large family child care' },
  { value: 'other', label: 'Other license type' },
]

function isValidState(code: string): boolean {
  return US_STATES.some(([c]) => c === code)
}

function isValidLicense(value: string): boolean {
  return LICENSE_TYPES.some((l) => l.value === value)
}

function friendlySignupError(raw: string): string {
  const msg = raw.toLowerCase()
  if (msg.includes('already registered') || msg.includes('already been registered')) {
    return 'You already have an account with that email. Sign in instead.'
  }
  if (msg.includes('password')) {
    return 'Your password needs at least 8 characters. A short phrase works well.'
  }
  if (msg.includes('invalid') && msg.includes('email')) {
    return "Hmm, that email doesn't look quite right. Mind checking it?"
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Too many tries in a row. Give it a minute, then try again.'
  }
  return "That didn't go through on our side. Give it one more try."
}

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const paramState = (searchParams.get('state') ?? '').toUpperCase()
  const paramLicense = searchParams.get('license') ?? ''

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [stateCode, setStateCode] = useState(isValidState(paramState) ? paramState : '')
  const [licenseType, setLicenseType] = useState(isValidLicense(paramLicense) ? paramLicense : 'family_child_care')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const stateName = useMemo(() => {
    const found = US_STATES.find(([code]) => code === stateCode)
    return found ? found[1] : null
  }, [stateCode])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Enter your email so we can send your confirmation link.')
      return
    }
    if (password.length < 8) {
      setError('Your password needs at least 8 characters. A short phrase works well.')
      return
    }
    setLoading(true)

    const metadata: Record<string, string> = { full_name: fullName.trim() }
    if (stateCode) metadata.state_code = stateCode
    if (licenseType) metadata.license_type = licenseType

    const supabase = getAuthSupabase()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        data: metadata,
      },
    })

    if (signUpError) {
      setError(friendlySignupError(signUpError.message))
      setLoading(false)
      return
    }

    // With confirmations on, Supabase returns an obfuscated user with zero
    // identities when the email is already registered. Say so, kindly.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError('You already have an account with that email. Sign in instead.')
      setLoading(false)
      return
    }

    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    setSentTo(email.trim())
    setLoading(false)
  }

  if (sentTo) {
    return (
      <div className={CARD_WIDE}>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-7 w-7 text-emerald-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-5 text-center font-display text-2xl font-bold tracking-tight text-slate-900">Check your inbox</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          We sent a confirmation link to <span className="font-semibold text-slate-900">{sentTo}</span>. Click it and we start building your renewal timeline.
        </p>
        <p className="mt-4 rounded-lg bg-slate-50 px-3.5 py-2.5 text-center text-xs text-slate-500">
          No email after a couple of minutes? Check your spam folder, or try again with a different address.
        </p>
        <button type="button" className={`${BTN_SECONDARY} mt-5`} onClick={() => { setSentTo(null); setPassword('') }}>
          Use a different email
        </button>
        <p className="mt-5 text-center text-sm text-slate-600">
          Already confirmed?{' '}
          <Link href="/login" className="font-semibold text-emerald-700 transition hover:text-emerald-800">Sign in</Link>
        </p>
      </div>
    )
  }

  return (
    <div className={CARD_WIDE}>
      <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Create your account</h1>
      <p className="mt-1.5 text-sm text-slate-600">
        Tell us your state and license, and your renewal timeline is ready the moment you land.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6">
        <div>
          <label htmlFor="fullName" className={LABEL}>Your name</label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={INPUT}
            placeholder="First and last name"
          />
        </div>

        <div className="mt-4">
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
          <label htmlFor="password" className={LABEL}>Password</label>
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
          <p className="mt-1.5 text-xs text-slate-500">At least 8 characters. A short phrase works well.</p>
        </div>

        <fieldset className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
          <legend className="px-1.5 text-sm font-semibold text-emerald-800">Speed up your setup</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="stateCode" className={LABEL}>Your state</label>
              <select
                id="stateCode"
                name="stateCode"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className={INPUT}
              >
                <option value="">Choose later</option>
                {US_STATES.map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="licenseType" className={LABEL}>License type</label>
              <select
                id="licenseType"
                name="licenseType"
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value)}
                className={INPUT}
              >
                {LICENSE_TYPES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>
          {stateName ? (
            <p className="mt-3 rounded-lg bg-white px-3.5 py-2.5 text-xs leading-relaxed text-emerald-800 ring-1 ring-emerald-100">
              Nice. The moment you land, we prebuild your {stateName} renewal sequence: CPR, first aid, background check, training hours, inspection prep and license renewal, in order.
            </p>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Optional now. Add your state anytime and your timeline builds itself.</p>
          )}
        </fieldset>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">
            {error}{' '}
            {error.includes('Sign in instead') && (
              <Link href="/login" className="font-semibold underline">Go to sign in</Link>
            )}
          </div>
        )}

        <button type="submit" className={`${BTN_PRIMARY} mt-6`} disabled={loading}>
          {loading && <Spinner />}
          {loading ? 'Creating your account...' : 'Create account'}
        </button>

        <p className="mt-3 text-center text-xs text-slate-500">
          We only email you about your account and your own renewal reminders.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-emerald-700 transition hover:text-emerald-800">Sign in</Link>
      </p>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<CardSkeleton wide />}>
      <SignupForm />
    </Suspense>
  )
}
