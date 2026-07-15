'use client'

// CANONICAL: FamComply settings page. Name, licensing details, and timezone.
// State and license type shape the timeline, so changing them offers a rebuild.

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiFetch, friendlyError, isUnauthorized } from '@/lib/core/api'
import { cx, LICENSE_OPTIONS, STATE_NAMES, STATE_OPTIONS, TIMEZONE_OPTIONS } from '@/lib/core/format'
import { ToastViewport, useToasts } from '@/lib/core/toast'
import type { LicenseType, Profile } from '@/lib/db/types'

const inputClass =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100'
const labelClass = 'block text-sm font-semibold text-slate-700'
const btnPrimary =
  'inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
const btnSecondary =
  'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'

export default function SettingsPage() {
  const { toasts, push, dismiss } = useToasts()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [licenseType, setLicenseType] = useState<'' | LicenseType>('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')

  const [saving, setSaving] = useState(false)
  const [rebuildSuggested, setRebuildSuggested] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await apiFetch<Profile>('/api/profile')
      setProfile(result.data)
      setFullName(result.data.full_name ?? '')
      setStateCode(result.data.state_code ?? '')
      setLicenseType(result.data.license_type ?? '')
      setLicenseNumber(result.data.license_number ?? '')
      setTimezone(result.data.timezone ?? 'America/New_York')
    } catch (error) {
      if (isUnauthorized(error)) {
        window.location.assign('/login')
        return
      }
      setLoadError(friendlyError(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profile) {
      return
    }

    const payload: Record<string, unknown> = {}
    const trimmedName = fullName.trim()
    if (trimmedName !== (profile.full_name ?? '')) {
      payload.full_name = trimmedName
    }
    if (stateCode !== '' && stateCode !== (profile.state_code ?? '')) {
      payload.state_code = stateCode
    }
    if (licenseType !== '' && licenseType !== (profile.license_type ?? '')) {
      payload.license_type = licenseType
    }
    const trimmedLicenseNumber = licenseNumber.trim()
    if (trimmedLicenseNumber !== (profile.license_number ?? '')) {
      payload.license_number = trimmedLicenseNumber === '' ? null : trimmedLicenseNumber
    }
    if (timezone !== profile.timezone) {
      payload.timezone = timezone
    }

    if (Object.keys(payload).length === 0) {
      push('info', 'Nothing changed yet. Update a field and save again.')
      return
    }

    setSaving(true)
    try {
      const result = await apiFetch<Profile>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      const changedLicensing = payload.state_code !== undefined || payload.license_type !== undefined
      setProfile(result.data)
      push('success', 'Saved. Your settings are up to date.')
      if (changedLicensing) {
        setRebuildSuggested(true)
      }
    } catch (error) {
      if (isUnauthorized(error)) {
        window.location.assign('/login')
        return
      }
      push('error', friendlyError(error))
    } finally {
      setSaving(false)
    }
  }

  const rebuild = async () => {
    setRebuilding(true)
    try {
      const result = await apiFetch<{ created_count: number; message: string }>('/api/timeline', {
        method: 'POST',
      })
      push('success', result.data.message)
      setRebuildSuggested(false)
    } catch (error) {
      if (isUnauthorized(error)) {
        window.location.assign('/login')
        return
      }
      push('error', friendlyError(error))
    } finally {
      setRebuilding(false)
    }
  }

  const timezoneChoices = TIMEZONE_OPTIONS.some((option) => option.value === timezone)
    ? TIMEZONE_OPTIONS
    : [...TIMEZONE_OPTIONS, { value: timezone, label: timezone }]

  const stateName = profile?.state_code ? STATE_NAMES[profile.state_code] ?? profile.state_code : 'your state'

  return (
    <>
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-slate-600">Your state and license type shape your timeline.</p>
        </header>

        {loading && (
          <div className="animate-pulse space-y-4" aria-hidden="true">
            <div className="h-48 rounded-2xl bg-slate-200" />
            <div className="h-64 rounded-2xl bg-slate-200" />
          </div>
        )}

        {!loading && loadError && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">{loadError}</p>
            <button type="button" onClick={() => void load()} className={cx(btnPrimary, 'mt-4')}>
              Try again
            </button>
          </div>
        )}

        {!loading && !loadError && profile && (
          <>
            {rebuildSuggested && (
              <section className="animate-fade-up rounded-2xl border border-teal-200 bg-teal-50 p-5">
                <h2 className="font-display text-base font-bold text-teal-900">New rules may apply</h2>
                <p className="mt-1 text-sm text-teal-800">
                  Rebuild your timeline to pull in core requirements for {stateName}. Everything you already track
                  stays put.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void rebuild()} disabled={rebuilding} className={btnPrimary}>
                    {rebuilding ? 'Rebuilding...' : 'Rebuild timeline'}
                  </button>
                  <button type="button" onClick={() => setRebuildSuggested(false)} className={btnSecondary}>
                    Skip
                  </button>
                </div>
              </section>
            )}

            <form onSubmit={save} className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-display text-lg font-bold text-slate-900">Profile</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="full-name" className={labelClass}>
                      Your name
                    </label>
                    <input
                      id="full-name"
                      maxLength={120}
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Maria Alvarez"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className={labelClass}>
                      Sign-in email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={profile.email ?? ''}
                      readOnly
                      disabled
                      className={cx(inputClass, 'bg-slate-50 text-slate-500')}
                    />
                    <p className="mt-1 text-xs text-slate-500">Reminder emails go here on the Pro plan.</p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-display text-lg font-bold text-slate-900">Licensing</h2>
                <p className="mt-1 text-sm text-slate-600">These two fields decide which requirements your timeline covers.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="state" className={labelClass}>
                      State
                    </label>
                    <select
                      id="state"
                      value={stateCode}
                      onChange={(event) => setStateCode(event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Choose a state</option>
                      {STATE_OPTIONS.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="license-type" className={labelClass}>
                      License type
                    </label>
                    <select
                      id="license-type"
                      value={licenseType}
                      onChange={(event) => setLicenseType(event.target.value as '' | LicenseType)}
                      className={inputClass}
                    >
                      <option value="">Choose a license type</option>
                      {LICENSE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="license-number" className={labelClass}>
                      License number (optional)
                    </label>
                    <input
                      id="license-number"
                      maxLength={60}
                      value={licenseNumber}
                      onChange={(event) => setLicenseNumber(event.target.value)}
                      placeholder="As shown on your license"
                      className={inputClass}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-display text-lg font-bold text-slate-900">Timezone</h2>
                <p className="mt-1 text-sm text-slate-600">Keeps your reminder dates aligned with your local calendar.</p>
                <div className="mt-4 sm:max-w-xs">
                  <label htmlFor="timezone" className={labelClass}>
                    Timezone
                  </label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    className={inputClass}
                  >
                    {timezoneChoices.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <div>
                <button type="submit" disabled={saving} className={btnPrimary}>
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </>
  )
}
