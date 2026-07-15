'use client'

// CANONICAL: FamComply reminders page. The schedule builds itself from expiration
// dates. Providers can review upcoming reminders, see history, and cancel one.
// BellIcon comes from lib/core/icons (shared with the nav; no inline duplicate).

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { apiFetch, friendlyError, isUnauthorized } from '@/lib/core/api'
import { BellIcon } from '@/lib/core/icons'
import { cx, formatDisplayDate, relativeDayLabel } from '@/lib/core/format'
import { ToastViewport, useToasts } from '@/lib/core/toast'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getEntitlements } from '@/lib/db/entitlements'
import type { ReminderWithRequirement } from '@/lib/db/types'

const btnPrimary =
  'inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
const btnSecondary =
  'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'

const REMINDER_STATUS_META: Record<string, { label: string; badge: string }> = {
  pending: { label: 'Scheduled', badge: 'bg-teal-100 text-teal-800' },
  sent: { label: 'Sent', badge: 'bg-emerald-100 text-emerald-800' },
  canceled: { label: 'Canceled', badge: 'bg-slate-100 text-slate-600' },
  failed: { label: 'Failed', badge: 'bg-rose-100 text-rose-800' },
}

function calendarParts(isoDate: string): { month: string; day: string } {
  const parsed = new Date(`${isoDate}T00:00:00Z`)
  return {
    month: parsed.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' }),
    day: String(parsed.getUTCDate()),
  }
}

export default function RemindersPage() {
  const { toasts, push, dismiss } = useToasts()

  const [view, setView] = useState<'upcoming' | 'history'>('upcoming')
  const [reloadNonce, setReloadNonce] = useState(0)
  const [reminders, setReminders] = useState<ReminderWithRequirement[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  const [planInfo, setPlanInfo] = useState<{ allowsEmail: boolean; name: string } | null>(null)
  const [email, setEmail] = useState('')

  useEffect(() => {
    let cancelled = false
    async function run() {
      setListLoading(true)
      setLoadError(null)
      try {
        const query = view === 'upcoming' ? 'status=pending&limit=100' : 'status=all&limit=100'
        const result = await apiFetch<ReminderWithRequirement[]>(`/api/reminders?${query}`)
        if (!cancelled) {
          setReminders(result.data)
        }
      } catch (error) {
        if (isUnauthorized(error)) {
          window.location.assign('/login')
          return
        }
        if (!cancelled) {
          setLoadError(friendlyError(error))
        }
      } finally {
        if (!cancelled) {
          setListLoading(false)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [view, reloadNonce])

  useEffect(() => {
    let cancelled = false
    async function loadPlan() {
      try {
        const supabase = createSupabaseBrowserClient()
        const { data } = await supabase.auth.getUser()
        if (!data.user || cancelled) {
          return
        }
        setEmail(data.user.email ?? '')
        const entitlements = await getEntitlements(supabase, data.user.id)
        if (!cancelled) {
          setPlanInfo({ allowsEmail: entitlements.allowsEmailReminders, name: entitlements.planName })
        }
      } catch {
        // The plan card simply stays hidden if this lookup fails.
      }
    }
    void loadPlan()
    return () => {
      cancelled = true
    }
  }, [])

  const cancelReminder = async (id: string) => {
    setCancelingId(id)
    try {
      await apiFetch<{ id: string }>(`/api/reminders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'canceled' }),
      })
      setReminders((prev) =>
        view === 'upcoming'
          ? prev.filter((reminder) => reminder.id !== id)
          : prev.map((reminder) =>
              reminder.id === id
                ? { ...reminder, status: 'canceled' as ReminderWithRequirement['status'] }
                : reminder
            )
      )
      push('success', 'Canceled. The rest of your schedule stays put.')
    } catch (error) {
      if (isUnauthorized(error)) {
        window.location.assign('/login')
        return
      }
      push('error', friendlyError(error))
    } finally {
      setCancelingId(null)
    }
  }

  return (
    <>
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Reminders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Built from your expiration dates. Change a date on your timeline and this schedule rebuilds itself.
          </p>
        </header>

        {planInfo && !planInfo.allowsEmail && (
          <div className="animate-fade-up items-center justify-between gap-4 rounded-xl border border-teal-200 bg-teal-50 p-4 sm:flex">
            <p className="text-sm text-teal-900">
              These reminder dates show here and on your timeline, but the Free plan does not send emails. Upgrade to
              Pro and each date below lands in your inbox automatically.
            </p>
            <Link href="/billing" className={cx(btnPrimary, 'mt-3 flex-none sm:mt-0')}>
              See Pro
            </Link>
          </div>
        )}
        {planInfo && planInfo.allowsEmail && (
          <div className="animate-fade-up rounded-xl border border-teal-200 bg-teal-50 p-4">
            <p className="text-sm text-teal-900">
              Email reminders are on. They go to {email !== '' ? email : 'your sign-in email'} on the dates below.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="Reminder view">
            <button
              type="button"
              onClick={() => setView('upcoming')}
              aria-pressed={view === 'upcoming'}
              className={cx(
                'rounded-md px-4 py-1.5 text-sm font-semibold transition-colors',
                view === 'upcoming' ? 'bg-teal-700 text-white' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Upcoming
            </button>
            <button
              type="button"
              onClick={() => setView('history')}
              aria-pressed={view === 'history'}
              className={cx(
                'rounded-md px-4 py-1.5 text-sm font-semibold transition-colors',
                view === 'history' ? 'bg-teal-700 text-white' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              History
            </button>
          </div>
          {!listLoading && reminders.length > 0 && (
            <p className="text-sm text-slate-500">
              {reminders.length} {view === 'upcoming' ? 'scheduled' : 'total'}
            </p>
          )}
        </div>

        {listLoading && (
          <ul className="animate-pulse space-y-3" aria-hidden="true">
            {[0, 1, 2, 3].map((slot) => (
              <li key={slot} className="h-20 rounded-xl bg-slate-200" />
            ))}
          </ul>
        )}

        {!listLoading && loadError && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">{loadError}</p>
            <button type="button" onClick={() => setReloadNonce((nonce) => nonce + 1)} className={cx(btnPrimary, 'mt-4')}>
              Try again
            </button>
          </div>
        )}

        {!listLoading && !loadError && reminders.length === 0 && view === 'upcoming' && (
          <div className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
              <BellIcon className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-slate-900">No reminders scheduled yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
              Reminders create themselves when your requirements have expiration dates. Add a date and this page fills
              in.
            </p>
            <Link href="/dashboard" className={cx(btnPrimary, 'mt-5')}>
              Open your timeline
            </Link>
          </div>
        )}

        {!listLoading && !loadError && reminders.length === 0 && view === 'history' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">
              Nothing here yet. Reminder history shows up after your first scheduled date.
            </p>
          </div>
        )}

        {!listLoading && !loadError && reminders.length > 0 && (
          <ul className="space-y-3">
            {reminders.map((reminder) => {
              const parts = calendarParts(reminder.remind_on)
              // QA-001: email delivery is a Pro entitlement, and the daily job cancels
              // free-plan email reminders when they come due. Label pending rows
              // honestly so free users are never promised an email that will not send.
              const statusMeta =
                reminder.status === 'pending' && planInfo
                  ? planInfo.allowsEmail
                    ? { label: 'Email scheduled', badge: 'bg-teal-100 text-teal-800' }
                    : { label: 'Not emailed on Free', badge: 'bg-amber-100 text-amber-800' }
                  : (REMINDER_STATUS_META[reminder.status] ?? REMINDER_STATUS_META.pending)
              return (
                <li
                  key={reminder.id}
                  className="animate-fade-up flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex h-11 w-11 flex-none flex-col items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                    <span className="text-[10px] font-semibold uppercase leading-none">{parts.month}</span>
                    <span className="mt-0.5 text-base font-bold leading-none">{parts.day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {reminder.requirement?.title ?? 'Tracked requirement'}
                    </p>
                    <p className="text-sm text-slate-600">
                      {relativeDayLabel(reminder.remind_on)}
                      {reminder.requirement?.expires_on
                        ? ` for the ${formatDisplayDate(reminder.requirement.expires_on)} deadline`
                        : ''}
                    </p>
                  </div>
                  {(view === 'history' || (reminder.status === 'pending' && planInfo !== null)) && (
                    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', statusMeta.badge)}>
                      {statusMeta.label}
                    </span>
                  )}
                  {reminder.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => void cancelReminder(reminder.id)}
                      disabled={cancelingId === reminder.id}
                      aria-label={`Cancel the ${formatDisplayDate(reminder.remind_on)} reminder for ${reminder.requirement?.title ?? 'this requirement'}`}
                      className={btnSecondary}
                    >
                      {cancelingId === reminder.id ? 'Canceling...' : 'Cancel'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </>
  )
}
