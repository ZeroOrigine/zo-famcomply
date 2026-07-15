'use client'

// CANONICAL: FamComply billing page. Current plan, the Free and Pro catalog from
// the plans API, Stripe checkout for upgrades, and the billing portal for changes.
// CheckIcon comes from lib/core/icons (shared; no inline duplicate).

import { useCallback, useEffect, useState } from 'react'
import { apiFetch, friendlyError, isUnauthorized } from '@/lib/core/api'
import { CheckIcon } from '@/lib/core/icons'
import { cx, formatDisplayDate, priceLabel, subscriptionStatusLabel } from '@/lib/core/format'
import { ToastViewport, useToasts } from '@/lib/core/toast'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getEntitlements, type Entitlements } from '@/lib/db/entitlements'
import type { Plan } from '@/lib/db/types'

const btnPrimary =
  'inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
const btnSecondary =
  'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'

type BillingInterval = 'monthly' | 'yearly'

interface SubscriptionRow {
  plan_slug: string
  status: string
  current_period_end: string | null
  cancel_at_period_end: boolean
  stripe_customer_id: string | null
}

async function requestRedirectUrl(
  path: string,
  payload: Record<string, unknown>,
  fallbackMessage: string
): Promise<string> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('We could not reach the payment service. Check your connection and try again.')
  }
  const body = (await response.json().catch(() => null)) as
    | { data?: { url?: unknown } | null; url?: unknown; error?: unknown }
    | null
  const nested = body?.data && typeof body.data === 'object' ? (body.data as { url?: unknown }).url : undefined
  const candidate = typeof nested === 'string' ? nested : typeof body?.url === 'string' ? body.url : null
  if (response.ok && candidate) {
    return candidate
  }
  const message = body && typeof body.error === 'string' && body.error.length > 0 ? body.error : fallbackMessage
  throw new Error(message)
}

function planPrice(plan: Plan, interval: BillingInterval): { amount: string; per: string } {
  if (interval === 'yearly' && plan.price_yearly_cents) {
    return { amount: priceLabel(plan.price_yearly_cents), per: 'per year' }
  }
  return { amount: priceLabel(plan.price_monthly_cents), per: 'per month' }
}

function describeSubscription(entitlements: Entitlements, subscription: SubscriptionRow | null): string {
  if (entitlements.subscriptionStatus === 'past_due' || entitlements.subscriptionStatus === 'unpaid') {
    return 'Your last payment did not go through. Update your card in the billing portal and Pro turns back on.'
  }
  if (entitlements.planSlug !== 'pro') {
    return 'You are on the free plan. Email reminders and unlimited tracking come with Pro.'
  }
  const periodEnd = subscription?.current_period_end
    ? formatDisplayDate(subscription.current_period_end.slice(0, 10))
    : null
  if (subscription?.cancel_at_period_end && periodEnd) {
    return `Pro stays on until ${periodEnd}, then your account moves to Free.`
  }
  if (entitlements.subscriptionStatus === 'trialing' && periodEnd) {
    return `Trial runs until ${periodEnd}.`
  }
  if (periodEnd) {
    return `Active. Renews on ${periodEnd}.`
  }
  return `Status: ${subscriptionStatusLabel(subscription?.status ?? entitlements.subscriptionStatus)}.`
}

export default function BillingPage() {
  const { toasts, push, dismiss } = useToasts()

  const [plans, setPlans] = useState<Plan[]>([])
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly')
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [portalBusy, setPortalBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const plansResult = await apiFetch<Plan[]>('/api/plans')
      setPlans(plansResult.data)
      try {
        const supabase = createSupabaseBrowserClient()
        const { data: userData } = await supabase.auth.getUser()
        if (userData.user) {
          const resolvedEntitlements = await getEntitlements(supabase, userData.user.id)
          setEntitlements(resolvedEntitlements)
          const { data: subscriptionRow } = await supabase
            .from('famcomply_subscriptions')
            .select('plan_slug, status, current_period_end, cancel_at_period_end, stripe_customer_id')
            .eq('user_id', userData.user.id)
            .maybeSingle()
          setSubscription((subscriptionRow as SubscriptionRow | null) ?? null)
        }
      } catch {
        // The plan catalog still renders even if the account lookup stumbles.
      }
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

  const startCheckout = async () => {
    setCheckoutBusy(true)
    try {
      const url = await requestRedirectUrl(
        '/api/checkout',
        { plan_slug: 'pro', interval: billingInterval },
        'Checkout is not available right now. Please try again in a moment.'
      )
      window.location.assign(url)
    } catch (error) {
      push('error', error instanceof Error ? error.message : 'Checkout is not available right now. Please try again in a moment.')
      setCheckoutBusy(false)
    }
  }

  const openPortal = async () => {
    setPortalBusy(true)
    try {
      const url = await requestRedirectUrl(
        '/api/billing/portal',
        {},
        'The billing portal is not reachable right now. Please try again shortly.'
      )
      window.location.assign(url)
    } catch (error) {
      push('error', error instanceof Error ? error.message : 'The billing portal is not reachable right now. Please try again shortly.')
      setPortalBusy(false)
    }
  }

  const showIntervalToggle = plans.some((plan) => plan.price_yearly_cents)

  return (
    <>
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Billing</h1>
          <p className="mt-1 text-sm text-slate-600">Two plans. The free plan covers your core timeline.</p>
        </header>

        {loading && (
          <div className="animate-pulse space-y-4" aria-hidden="true">
            <div className="h-24 rounded-2xl bg-slate-200" />
            <div className="grid gap-6 md:grid-cols-2">
              <div className="h-80 rounded-2xl bg-slate-200" />
              <div className="h-80 rounded-2xl bg-slate-200" />
            </div>
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

        {!loading && !loadError && (
          <>
            {entitlements && (
              <section className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">{entitlements.planName} plan</h2>
                    <p className="mt-1 text-sm text-slate-600">{describeSubscription(entitlements, subscription)}</p>
                  </div>
                  {subscription?.stripe_customer_id && (
                    <button type="button" onClick={() => void openPortal()} disabled={portalBusy} className={btnSecondary}>
                      {portalBusy ? 'Opening...' : 'Manage billing'}
                    </button>
                  )}
                </div>
              </section>
            )}

            {showIntervalToggle && (
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="Billing interval">
                {(['monthly', 'yearly'] as const).map((intervalOption) => (
                  <button
                    key={intervalOption}
                    type="button"
                    onClick={() => setBillingInterval(intervalOption)}
                    aria-pressed={billingInterval === intervalOption}
                    className={cx(
                      'rounded-md px-4 py-1.5 text-sm font-semibold transition-colors',
                      billingInterval === intervalOption ? 'bg-teal-700 text-white' : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    {intervalOption === 'monthly' ? 'Monthly' : 'Yearly'}
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {plans.map((plan) => {
                const isCurrent = entitlements ? plan.slug === entitlements.planSlug : plan.slug === 'free'
                const price = planPrice(plan, billingInterval)
                const yearlySavings =
                  plan.slug === 'pro' &&
                  billingInterval === 'yearly' &&
                  plan.price_yearly_cents &&
                  plan.price_monthly_cents > 0
                    ? plan.price_monthly_cents * 12 - plan.price_yearly_cents
                    : 0
                return (
                  <article
                    key={plan.slug}
                    className={cx(
                      'animate-fade-up flex flex-col rounded-2xl border bg-white p-6 shadow-sm',
                      isCurrent ? 'border-teal-300 ring-2 ring-teal-100' : 'border-slate-200'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-display text-lg font-bold text-slate-900">{plan.name}</h2>
                      {isCurrent && (
                        <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{plan.description}</p>
                    <p className="mt-4">
                      <span className="font-display text-3xl font-bold text-slate-900">{price.amount}</span>
                      <span className="text-sm text-slate-500"> {price.per}</span>
                    </p>
                    {yearlySavings > 0 && (
                      <p className="mt-1 text-sm font-semibold text-teal-700">
                        {priceLabel(yearlySavings)} less than paying monthly for a year.
                      </p>
                    )}
                    <ul className="mt-4 flex-1 space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                          <CheckIcon className="mt-0.5 h-4 w-4 flex-none text-teal-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6">
                      {isCurrent ? (
                        <span className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-500">
                          Your current plan
                        </span>
                      ) : plan.slug === 'pro' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void startCheckout()}
                            disabled={checkoutBusy}
                            className={cx(btnPrimary, 'w-full py-2.5')}
                          >
                            {checkoutBusy ? 'Opening checkout...' : 'Upgrade to Pro'}
                          </button>
                          <p className="mt-2 text-center text-xs text-slate-500">
                            Billed through Stripe checkout. Cancel anytime in the billing portal.
                          </p>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void openPortal()}
                          disabled={portalBusy}
                          className={cx(btnSecondary, 'w-full py-2.5')}
                        >
                          {portalBusy ? 'Opening...' : 'Switch plans in the billing portal'}
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>

            <p className="text-sm text-slate-500">
              Payments run through Stripe. Your card details never touch FamComply servers.
            </p>
          </>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </>
  )
}
