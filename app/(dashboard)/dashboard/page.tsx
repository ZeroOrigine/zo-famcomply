'use client'

// CANONICAL: FamComply dashboard. The core move lives here: pick your state and
// license type, get the sequenced renewal timeline, add dates, reminders follow.
// Shared icons come from lib/core/icons (no inline duplicates).

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError, apiFetch, friendlyError, isUnauthorized } from '@/lib/core/api'
import { CheckIcon, PlusIcon } from '@/lib/core/icons'
import {
  cx,
  dueLabel,
  formatDisplayDate,
  KIND_LABELS,
  LICENSE_OPTIONS,
  STATE_NAMES,
  STATE_OPTIONS,
  STATUS_META,
} from '@/lib/core/format'
import { ToastViewport, useToasts } from '@/lib/core/toast'
import { todayUtcIsoDate } from '@/lib/db/dates'
import {
  REQUIREMENT_KINDS,
  type LicenseType,
  type Profile,
  type ProviderRequirement,
  type RequirementKind,
  type RequirementStatus,
} from '@/lib/db/types'

const inputClass =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100'
const labelClass = 'block text-sm font-semibold text-slate-700'
const btnPrimary =
  'inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
const btnSecondary =
  'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
const btnDanger =
  'inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600'
const btnGhostDanger =
  'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600'

const CORE_PREVIEW = [
  { title: 'Pediatric CPR certification', note: 'Usually on a 2 year cycle, and license renewal depends on it.' },
  { title: 'Pediatric first aid certification', note: 'Best booked together with your CPR class.' },
  { title: 'Comprehensive background check', note: 'For you and every adult in your home, at least every 5 years.' },
  { title: 'Annual training hours', note: 'Finished before your renewal window opens.' },
  { title: 'Home inspection prep', note: 'A walkthrough before the licensing visit.' },
  { title: 'License renewal', note: 'The renewal itself, once everything above is current.' },
] as const

interface TimelineReadResult {
  items: ProviderRequirement[]
}

interface TimelineBuildResult {
  created: ProviderRequirement[]
  created_count: number
  message: string
}

interface ItemDraft {
  issued_on: string
  expires_on: string
  notes: string
}

function sortItems(items: ProviderRequirement[]): ProviderRequirement[] {
  return [...items].sort((a, b) => {
    if (a.sequence_order !== b.sequence_order) {
      return a.sequence_order - b.sequence_order
    }
    return (a.expires_on ?? '9999-12-31').localeCompare(b.expires_on ?? '9999-12-31')
  })
}

function StatusBadge({ status }: { status: RequirementStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', meta.badge)}>
      <span aria-hidden="true" className={cx('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden="true">
      <div className="space-y-2">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="h-8 w-72 rounded-lg bg-slate-200" />
      </div>
      <div className="h-28 rounded-2xl bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[0, 1, 2, 3, 4].map((slot) => (
          <div key={slot} className="h-16 rounded-xl bg-slate-200" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5].map((slot) => (
          <div key={slot} className="h-24 rounded-xl bg-slate-200" />
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { toasts, push, dismiss } = useToasts()

  const [phase, setPhase] = useState<'loading' | 'setup' | 'ready'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [items, setItems] = useState<ProviderRequirement[]>([])

  const [stateCode, setStateCode] = useState('')
  const [licenseType, setLicenseType] = useState<LicenseType>('family_child_care')
  const [building, setBuilding] = useState(false)
  const [justBuilt, setJustBuilt] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ItemDraft>({ issued_on: '', expires_on: '', notes: '' })
  const [savingId, setSavingId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  const [showAddForm, setShowAddForm] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [addKind, setAddKind] = useState<RequirementKind>('continuing_education')
  const [addExpiresOn, setAddExpiresOn] = useState('')
  const [adding, setAdding] = useState(false)
  const [limitNotice, setLimitNotice] = useState<string | null>(null)

  const goLogin = () => {
    window.location.assign('/login')
  }

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [profileResult, timelineResult] = await Promise.all([
        apiFetch<Profile>('/api/profile'),
        apiFetch<TimelineReadResult>('/api/timeline'),
      ])
      setProfile(profileResult.data)
      const sorted = sortItems(timelineResult.data.items)
      setItems(sorted)
      if (profileResult.data.state_code) {
        setStateCode(profileResult.data.state_code)
      }
      if (profileResult.data.license_type) {
        setLicenseType(profileResult.data.license_type)
      }
      setPhase(sorted.length > 0 ? 'ready' : 'setup')
    } catch (error) {
      if (isUnauthorized(error)) {
        goLogin()
        return
      }
      setLoadError(friendlyError(error))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // The GET /api/checkout flow can bounce users back here with
  // ?billing=already-subscribed. Surface what happened as a toast, then
  // clean the URL so a refresh doesn't repeat the message.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const billing = params.get('billing')
    if (billing === null) {
      return
    }
    if (billing === 'already-subscribed') {
      push(
        'success',
        'You already have an active Pro subscription, so no new checkout was needed. You can manage your plan anytime from the Billing page.'
      )
    } else {
      push('error', 'That billing step did not finish. Visit the Billing page to review your plan or try again.')
    }
    params.delete('billing')
    const rest = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${rest === '' ? '' : `?${rest}`}`)
  }, [push])

  const summary = useMemo(() => {
    const counts: Record<RequirementStatus, number> = {
      not_started: 0,
      on_track: 0,
      due_soon: 0,
      overdue: 0,
      completed: 0,
    }
    let next: ProviderRequirement | null = null
    let datedCount = 0
    for (const item of items) {
      counts[item.status] += 1
      if (item.completed_on === null && item.expires_on !== null) {
        datedCount += 1
        if (!next || !next.expires_on || item.expires_on < next.expires_on) {
          next = item
        }
      }
    }
    return { counts, next, datedCount, total: items.length }
  }, [items])

  const replaceItem = (nextItem: ProviderRequirement) => {
    setItems((prev) => sortItems(prev.map((item) => (item.id === nextItem.id ? nextItem : item))))
  }

  const openItem = (item: ProviderRequirement) => {
    setExpandedId(item.id)
    setConfirmRemoveId(null)
    setDraft({
      issued_on: item.issued_on ?? '',
      expires_on: item.expires_on ?? '',
      notes: item.notes ?? '',
    })
  }

  const toggleItem = (item: ProviderRequirement) => {
    if (expandedId === item.id) {
      setExpandedId(null)
      return
    }
    openItem(item)
  }

  const buildTimeline = async () => {
    if (!stateCode) {
      push('error', 'Pick your state first. That is what shapes your timeline.')
      return
    }
    setBuilding(true)
    try {
      const needsProfileUpdate =
        profile?.state_code !== stateCode ||
        profile?.license_type !== licenseType ||
        !profile?.onboarding_completed
      if (needsProfileUpdate) {
        const updated = await apiFetch<Profile>('/api/profile', {
          method: 'PATCH',
          body: JSON.stringify({
            state_code: stateCode,
            license_type: licenseType,
            onboarding_completed: true,
          }),
        })
        setProfile(updated.data)
      }
      const built = await apiFetch<TimelineBuildResult>('/api/timeline', { method: 'POST' })
      const refreshed = await apiFetch<TimelineReadResult>('/api/timeline')
      setItems(sortItems(refreshed.data.items))
      setPhase('ready')
      if (built.data.created_count > 0) {
        setJustBuilt(true)
      }
      push('success', built.data.message)
    } catch (error) {
      if (isUnauthorized(error)) {
        goLogin()
        return
      }
      push('error', friendlyError(error))
    } finally {
      setBuilding(false)
    }
  }

  const startWithCpr = () => {
    const target = items.find((item) => item.requirement_kind === 'cpr_certification') ?? items[0]
    if (!target) {
      return
    }
    setJustBuilt(false)
    openItem(target)
    window.setTimeout(() => {
      document.getElementById(`req-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
  }

  const saveItem = async (item: ProviderRequirement) => {
    setSavingId(item.id)
    try {
      const result = await apiFetch<ProviderRequirement>(`/api/requirements/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          issued_on: draft.issued_on === '' ? null : draft.issued_on,
          expires_on: draft.expires_on === '' ? null : draft.expires_on,
          notes: draft.notes,
        }),
      })
      replaceItem(result.data)
      const startedCountdown = item.expires_on === null && result.data.expires_on !== null
      if (startedCountdown && result.data.expires_on) {
        push(
          'success',
          `Countdown started. ${result.data.title} is on the calendar for ${formatDisplayDate(result.data.expires_on)}.`
        )
      } else {
        push('success', 'Saved. Your reminder schedule now matches.')
      }
    } catch (error) {
      if (isUnauthorized(error)) {
        goLogin()
        return
      }
      push('error', friendlyError(error))
    } finally {
      setSavingId(null)
    }
  }

  const setDone = async (item: ProviderRequirement, done: boolean) => {
    setSavingId(item.id)
    try {
      const result = await apiFetch<ProviderRequirement>(`/api/requirements/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed_on: done ? todayUtcIsoDate() : null }),
      })
      replaceItem(result.data)
      push('success', done ? 'Done. One less thing on your plate.' : 'Back on the tracker. Update its dates when you can.')
    } catch (error) {
      if (isUnauthorized(error)) {
        goLogin()
        return
      }
      push('error', friendlyError(error))
    } finally {
      setSavingId(null)
    }
  }

  const removeItem = async (item: ProviderRequirement) => {
    setSavingId(item.id)
    try {
      await apiFetch<{ id: string; deleted: boolean }>(`/api/requirements/${item.id}`, { method: 'DELETE' })
      setItems((prev) => {
        const nextItems = prev.filter((existing) => existing.id !== item.id)
        if (nextItems.length === 0) {
          setPhase('setup')
        }
        return nextItems
      })
      setExpandedId(null)
      setConfirmRemoveId(null)
      push('success', `${item.title} is off your timeline.`)
    } catch (error) {
      if (isUnauthorized(error)) {
        goLogin()
        return
      }
      push('error', friendlyError(error))
    } finally {
      setSavingId(null)
    }
  }

  const addCustom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAdding(true)
    try {
      const payload: Record<string, unknown> = {
        title: addTitle.trim(),
        requirement_kind: addKind,
      }
      if (addExpiresOn !== '') {
        payload.expires_on = addExpiresOn
      }
      const result = await apiFetch<ProviderRequirement>('/api/requirements', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setItems((prev) => sortItems([...prev, result.data]))
      setShowAddForm(false)
      setAddTitle('')
      setAddExpiresOn('')
      setAddKind('continuing_education')
      push('success', `${result.data.title} is on your timeline now.`)
    } catch (error) {
      if (isUnauthorized(error)) {
        goLogin()
        return
      }
      if (error instanceof ApiError && error.code === 'PLAN_LIMIT_REACHED') {
        setShowAddForm(false)
        setLimitNotice(error.message)
      } else {
        push('error', friendlyError(error))
      }
    } finally {
      setAdding(false)
    }
  }

  const firstName = (profile?.full_name ?? '').trim().split(' ')[0] ?? ''
  const licenseLabel = profile?.license_type
    ? LICENSE_OPTIONS.find((option) => option.value === profile.license_type)?.label ?? 'Licensed provider'
    : 'Licensed provider'
  const stateName = profile?.state_code ? STATE_NAMES[profile.state_code] ?? profile.state_code : null

  return (
    <>
      {phase === 'loading' && !loadError && <DashboardSkeleton />}

      {phase === 'loading' && loadError && (
        <div className="mx-auto max-w-md py-16 text-center">
          <h1 className="font-display text-xl font-bold text-slate-900">We could not load your timeline</h1>
          <p className="mt-2 text-sm text-slate-600">{loadError}</p>
          <button type="button" onClick={() => void load()} className={cx(btnPrimary, 'mt-6')}>
            Try again
          </button>
        </div>
      )}

      {phase === 'setup' && (
        <section className="animate-fade-up">
          <div className="mx-auto max-w-2xl">
            <header className="text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">FamComply</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-slate-900 sm:text-4xl">
                Let&apos;s build your renewal timeline
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-base text-slate-600">
                Pick your state and license type. FamComply lines up the core requirements in the order licensing
                expects, then reminds you before each one.
              </p>
            </header>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="setup-state" className={labelClass}>
                    Your state
                  </label>
                  <select
                    id="setup-state"
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
                  <label htmlFor="setup-license" className={labelClass}>
                    Your license type
                  </label>
                  <select
                    id="setup-license"
                    value={licenseType}
                    onChange={(event) => setLicenseType(event.target.value as LicenseType)}
                    className={inputClass}
                  >
                    {LICENSE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void buildTimeline()}
                disabled={building || stateCode === ''}
                className={cx(btnPrimary, 'mt-6 w-full py-3 text-base')}
              >
                {building ? 'Building your timeline...' : 'Build my timeline'}
              </button>
              <p className="mt-3 text-center text-sm text-slate-500">
                Takes about 20 seconds. You can adjust everything after.
              </p>
            </div>

            <div className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Your timeline will cover</h2>
              <ol className="mt-3 space-y-2">
                {CORE_PREVIEW.map((step, index) => (
                  <li key={step.title} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-800"
                    >
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                      <p className="text-sm text-slate-600">{step.note}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}

      {phase === 'ready' && (
        <div className="space-y-6">
          {justBuilt && (
            <section className="animate-fade-up rounded-2xl border border-teal-200 bg-teal-50 p-5">
              <div className="flex items-start gap-3">
                <span className="animate-pop flex h-10 w-10 flex-none items-center justify-center rounded-full bg-teal-700 text-white">
                  <CheckIcon className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <h2 className="font-display text-lg font-bold text-teal-900">Your timeline is live</h2>
                  <p className="mt-1 text-sm text-teal-800">
                    Every core requirement is tracked in the right order. Start with step 1: add the expiration date on
                    your CPR card. It takes about 30 seconds.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={startWithCpr} className={btnPrimary}>
                      Add my CPR date
                    </button>
                    <button type="button" onClick={() => setJustBuilt(false)} className={btnSecondary}>
                      Later
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          <header>
            {firstName !== '' && <p className="text-sm font-semibold text-teal-700">Good to see you, {firstName}.</p>}
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl">Your renewal timeline</h1>
            <p className="mt-1 text-sm text-slate-600">
              {licenseLabel}
              {stateName ? ` in ${stateName}` : ''}. Reminders follow your dates automatically.{' '}
              <Link href="/settings" className="font-semibold text-teal-700 transition-colors hover:text-teal-900">
                Change
              </Link>
            </p>
          </header>

          {summary.counts.overdue > 0 ? (
            <section className="animate-fade-up rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Needs attention now</p>
              <h2 className="mt-1 font-display text-xl font-bold text-rose-900">
                {summary.counts.overdue === 1
                  ? 'One requirement is overdue.'
                  : `${summary.counts.overdue} requirements are overdue.`}
              </h2>
              <p className="mt-1 text-sm text-rose-800">
                A lapse here can hold up your license. Handle these first, then mark them done.
              </p>
            </section>
          ) : summary.next ? (
            <section className="animate-fade-up rounded-2xl bg-teal-700 p-5 text-white shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-teal-100">Next deadline</p>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl font-bold">{summary.next.title}</h2>
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
                  {dueLabel(summary.next.expires_on, null)}
                </span>
              </div>
              <p className="mt-1 text-sm text-teal-100">
                {formatDisplayDate(summary.next.expires_on)}. Reminders are queued ahead of it.
              </p>
            </section>
          ) : summary.total > 0 ? (
            <section className="animate-fade-up rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-display text-lg font-bold text-amber-900">Add your dates and the countdowns start</h2>
              <p className="mt-1 text-sm text-amber-800">
                Open each step below, add its expiration date, and reminders schedule themselves.
              </p>
            </section>
          ) : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(['overdue', 'due_soon', 'on_track', 'completed', 'not_started'] as RequirementStatus[]).map((status) => {
              const count = summary.counts[status]
              const colorByStatus: Record<RequirementStatus, string> = {
                overdue: 'text-rose-700',
                due_soon: 'text-amber-700',
                on_track: 'text-emerald-700',
                completed: 'text-teal-700',
                not_started: 'text-slate-500',
              }
              return (
                <div key={status} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className={cx('font-display text-2xl font-bold', count === 0 ? 'text-slate-300' : colorByStatus[status])}>
                    {count}
                  </p>
                  <p className="text-xs font-medium text-slate-500">{STATUS_META[status].label}</p>
                </div>
              )
            })}
          </div>

          {limitNotice && (
            <section className="animate-fade-up rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-display text-base font-bold text-amber-900">Room for more on Pro</h2>
              <p className="mt-1 text-sm text-amber-800">{limitNotice}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/billing" className={btnPrimary}>
                  See Pro pricing
                </Link>
                <button type="button" onClick={() => setLimitNotice(null)} className={btnSecondary}>
                  Not now
                </button>
              </div>
            </section>
          )}

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900">The sequence</h2>
              <p className="text-sm text-slate-500">
                {summary.total} tracked. Handle them top to bottom and license renewal has everything it needs.
              </p>
            </div>
            <ol className="mt-4 space-y-3">
              {items.map((item, index) => {
                const meta = STATUS_META[item.status]
                const open = expandedId === item.id
                const busy = savingId === item.id
                return (
                  <li key={item.id} id={`req-${item.id}`} className="relative pl-12">
                    {index < items.length - 1 && (
                      <span aria-hidden="true" className="absolute -bottom-3 left-4 top-12 w-px bg-slate-200" />
                    )}
                    <span
                      aria-hidden="true"
                      className={cx(
                        'absolute left-0 top-4 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold',
                        meta.ring
                      )}
                    >
                      {item.status === 'completed' ? <CheckIcon className="h-4 w-4" /> : index + 1}
                    </span>
                    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-display text-base font-semibold text-slate-900">{item.title}</h3>
                          <p className="mt-0.5 text-sm text-slate-600">
                            {KIND_LABELS[item.requirement_kind]}
                            {item.completed_on ? (
                              <> · Completed {formatDisplayDate(item.completed_on)}</>
                            ) : item.expires_on ? (
                              <>
                                {' '}· Expires {formatDisplayDate(item.expires_on)} ·{' '}
                                <span
                                  className={cx(
                                    'font-semibold',
                                    item.status === 'overdue'
                                      ? 'text-rose-700'
                                      : item.status === 'due_soon'
                                        ? 'text-amber-700'
                                        : 'text-emerald-700'
                                  )}
                                >
                                  {dueLabel(item.expires_on, null)}
                                </span>
                              </>
                            ) : (
                              <> · No date yet. Add it and reminders start automatically.</>
                            )}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>

                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => toggleItem(item)}
                          aria-expanded={open}
                          className={btnSecondary}
                        >
                          {open ? 'Close' : item.status === 'not_started' ? 'Add dates' : 'Edit'}
                        </button>
                      </div>

                      {open && (
                        <div className="animate-fade-up mt-4 border-t border-slate-100 pt-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label htmlFor={`issued-${item.id}`} className={labelClass}>
                                Issued on
                              </label>
                              <input
                                type="date"
                                id={`issued-${item.id}`}
                                value={draft.issued_on}
                                onChange={(event) => setDraft((prev) => ({ ...prev, issued_on: event.target.value }))}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label htmlFor={`expires-${item.id}`} className={labelClass}>
                                Expires on
                              </label>
                              <input
                                type="date"
                                id={`expires-${item.id}`}
                                value={draft.expires_on}
                                onChange={(event) => setDraft((prev) => ({ ...prev, expires_on: event.target.value }))}
                                className={inputClass}
                              />
                            </div>
                          </div>
                          {(item.requirement_kind === 'cpr_certification' ||
                            item.requirement_kind === 'first_aid_certification') && (
                            <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
                              Tip: many providers book CPR and first aid as one class. Set both dates while you&apos;re
                              here.
                            </p>
                          )}
                          <div className="mt-4">
                            <label htmlFor={`notes-${item.id}`} className={labelClass}>
                              Notes
                            </label>
                            <textarea
                              id={`notes-${item.id}`}
                              rows={2}
                              maxLength={2000}
                              value={draft.notes}
                              onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
                              placeholder="Class location, confirmation numbers, anything future you will want."
                              className={inputClass}
                            />
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void saveItem(item)}
                              disabled={busy}
                              className={btnPrimary}
                            >
                              {busy ? 'Saving...' : 'Save'}
                            </button>
                            {item.completed_on ? (
                              <button
                                type="button"
                                onClick={() => void setDone(item, false)}
                                disabled={busy}
                                className={btnSecondary}
                              >
                                Mark not done
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void setDone(item, true)}
                                disabled={busy}
                                className={btnSecondary}
                              >
                                Mark done
                              </button>
                            )}
                            {item.template_id === null &&
                              (confirmRemoveId === item.id ? (
                                <button
                                  type="button"
                                  onClick={() => void removeItem(item)}
                                  disabled={busy}
                                  className={btnDanger}
                                >
                                  Yes, remove it
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmRemoveId(item.id)}
                                  className={btnGhostDanger}
                                >
                                  Remove
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </article>
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5">
            {showAddForm ? (
              <form onSubmit={addCustom} className="animate-fade-up">
                <h2 className="font-display text-lg font-bold text-slate-900">Add a local rule</h2>
                <p className="mt-1 text-sm text-slate-600">
                  County and city requirements, like a fire inspection, live on the same timeline.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="add-title" className={labelClass}>
                      What is it?
                    </label>
                    <input
                      id="add-title"
                      required
                      minLength={2}
                      maxLength={200}
                      value={addTitle}
                      onChange={(event) => setAddTitle(event.target.value)}
                      placeholder="County fire inspection"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="add-kind" className={labelClass}>
                      Type
                    </label>
                    <select
                      id="add-kind"
                      value={addKind}
                      onChange={(event) => setAddKind(event.target.value as RequirementKind)}
                      className={inputClass}
                    >
                      {REQUIREMENT_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {KIND_LABELS[kind]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="add-expires" className={labelClass}>
                      Expires on (optional)
                    </label>
                    <input
                      type="date"
                      id="add-expires"
                      value={addExpiresOn}
                      onChange={(event) => setAddExpiresOn(event.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="submit" disabled={adding} className={btnPrimary}>
                    {adding ? 'Adding...' : 'Add to timeline'}
                  </button>
                  <button type="button" onClick={() => setShowAddForm(false)} className={btnSecondary}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(true)
                  setLimitNotice(null)
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-teal-700 transition-colors hover:text-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <PlusIcon className="h-4 w-4" />
                Add a local rule
              </button>
            )}
          </section>
        </div>
      )}

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </>
  )
}
