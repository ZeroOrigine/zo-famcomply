'use client'

// CANONICAL: FamComply pricing tiers and billing toggle. Single source of truth
// for marketing plan display, used on "/" and "/pricing".
// IMPORTANT: names, prices, and features here must match the famcomply_plans
// seed exactly (the table checkout and entitlements actually enforce):
//   free -> $0: state-based timeline, 6 core requirements, in-app reminders,
//               up to 6 tracked requirements
//   pro  -> $9/month or $79/year: email reminders, unlimited tracked
//               requirements, custom county and city rules
// The in-app billing page reads this same catalog live from the database.

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type MarketingPlan = {
  slug: 'free' | 'pro'
  name: string
  blurb: string
  monthly: number
  yearly: number | null
  features: string[]
  cta: string
  ctaNote: string
  popular?: boolean
}

const PLANS: MarketingPlan[] = [
  {
    slug: 'free',
    name: 'Free',
    blurb: 'Your core renewal timeline with in-app reminders. Not a teaser, not a trial.',
    monthly: 0,
    yearly: null,
    features: [
      'Pre-built renewal timeline for your state and license',
      'All 6 core requirements in the right order',
      'In-app reminders on your dashboard',
      'Track up to 6 requirements',
    ],
    cta: 'Get started free',
    ctaNote: 'No credit card required',
  },
  {
    slug: 'pro',
    name: 'Pro',
    blurb: 'Email reminders and room to track everything, including local rules.',
    monthly: 9,
    yearly: 79,
    popular: true,
    features: [
      'Everything in Free',
      'Email reminders before every deadline',
      'Unlimited tracked requirements',
      'Custom requirements for county and city rules',
    ],
    cta: 'Start free, then go Pro',
    ctaNote: 'Create a free account first. Upgrading takes two clicks from Billing.',
  },
]

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export default function PricingSection() {
  const [annual, setAnnual] = useState(false)
  const searchParams = useSearchParams()
  const checkoutUnavailable = searchParams.get('checkout') === 'unavailable'

  const priceNote = (plan: MarketingPlan) => {
    if (plan.monthly === 0) return 'Free for good. No card needed.'
    if (annual) return '$79 billed once a year. Cancel anytime.'
    return 'Billed monthly. Cancel anytime.'
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {checkoutUnavailable && (
        <div
          role="alert"
          className="mx-auto mb-8 max-w-2xl rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <p className="font-semibold">We couldn&rsquo;t start checkout just now.</p>
          <p className="mt-1">
            Nothing was charged. Please try again in a moment, or upgrade from{' '}
            <Link href="/dashboard" className="font-semibold underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-100">
              Billing
            </Link>{' '}
            once you&rsquo;re signed in.
          </p>
        </div>
      )}

      {/* Billing toggle */}
      <div className="flex flex-col items-center gap-3">
        <div
          role="group"
          aria-label="Billing period"
          className="inline-flex items-center rounded-full border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <button
            type="button"
            aria-pressed={!annual}
            onClick={() => setAnnual(false)}
            className={`inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold transition-colors duration-150 ${
              !annual
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={annual}
            onClick={() => setAnnual(true)}
            className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors duration-150 ${
              annual
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            Annual
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                annual
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
              }`}
            >
              Save $29
            </span>
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Pro is $9 a month, or $79 a year. That saves $29 versus paying monthly. The Free plan is not a trial.
        </p>
      </div>

      {/* Plan cards */}
      <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
        {PLANS.map((plan) => (
          <div
            key={plan.slug}
            className={`relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm transition-shadow duration-200 hover:shadow-md dark:bg-gray-900 ${
              plan.popular ? 'border-emerald-600 ring-2 ring-emerald-600' : 'border-gray-200 dark:border-gray-800'
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                Most popular
              </span>
            )}
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>
            <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">{plan.blurb}</p>
            <div className="mt-6 flex items-baseline gap-1.5">
              <span className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                ${annual && plan.yearly !== null ? plan.yearly : plan.monthly}
              </span>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {plan.monthly === 0 ? 'forever' : annual && plan.yearly !== null ? '/year' : '/month'}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{priceNote(plan)}</p>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-gray-700 dark:text-gray-300">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className={`mt-8 inline-flex h-12 items-center justify-center rounded-xl px-6 text-base font-semibold shadow-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                plan.popular
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {plan.cta}
            </Link>
            <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">{plan.ctaNote}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-gray-500 dark:text-gray-400">
        Prices in USD. Upgrade, downgrade, or cancel anytime from Billing. Every plan includes the sequenced timeline
        and dashboard reminders; email delivery is a Pro feature.
      </p>
    </div>
  )
}
