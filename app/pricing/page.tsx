// CANONICAL: FamComply pricing page (route "/pricing"). Renders the shared canonical PricingSection plus pricing-specific FAQ and CTA.
// Copy rule: prices must match the famcomply_plans seed (Free $0; Pro $9/month or $79/year). No invented plans.
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/marketing/site-header'
import PricingSection from '@/components/marketing/pricing-section'
import { PlusIcon } from '@/lib/core/icons'

// #100: a descendant reads URL search params (useSearchParams); opt this
// route out of static generation so `next build` does not CSR-bail.
export const dynamic = 'force-dynamic';

type PricingSearchParams = { checkout?: string | string[] }

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value ?? null
}

export const metadata: Metadata = {
  title: 'Pricing | FamComply',
  description:
    'Free covers your core renewal timeline with in-app reminders, for good. Pro at $9 per month (or $79 per year) adds email reminders, unlimited tracking, and custom county and city rules.',
  openGraph: {
    title: 'FamComply pricing',
    description:
      'Free covers your core renewal timeline, for good. Pro at $9 per month or $79 per year adds email reminders, unlimited tracking, and custom local rules.',
    type: 'website',
    url: '/pricing',
    siteName: 'FamComply',
  },
  alternates: { canonical: '/pricing' },
}

const PRICING_FAQS = [
  {
    q: 'Can I switch plans later?',
    a: 'Yes. Upgrade, downgrade, or cancel from your Billing page whenever you like.',
  },
  {
    q: 'Is the Free plan a trial?',
    a: 'No. Free covers your full state-based sequence, all 6 core requirements, and in-app reminders, for good. Pro exists for email reminders, unlimited tracked requirements, and custom county and city rules.',
  },
  {
    q: 'What happens if I cancel Pro?',
    a: 'You move to the Free plan and keep your timeline and dashboard reminders. Nothing is deleted.',
  },
  {
    q: 'How does annual billing work?',
    a: 'Pro is $9 per month, or $79 billed once a year. Paying yearly saves $29 compared with twelve monthly payments.',
  },
]

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? 'h-5 w-5'}
    >
      <path d="M3 10.5 12 3l9 7.5 M5 9.5V21h14V9.5 M9.5 21v-5.5h5V21" />
    </svg>
  )
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<PricingSearchParams>
}) {
  const resolved = searchParams ? await searchParams : undefined
  const checkout = firstParam(resolved?.checkout)
  const checkoutUnavailable = checkout === 'unavailable'

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <SiteHeader />
      <main>
        {checkoutUnavailable && (
          <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 lg:px-8">
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 flex-none text-amber-600 dark:text-amber-400"
              >
                <path d="M12 9v4 M12 17h.01 M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
              <p>
                We couldn&apos;t start checkout just now. Please try again in a moment, or reach us at{' '}
                <a href="mailto:support@zeroorigine.com" className="font-semibold underline">
                  support@zeroorigine.com
                </a>{' '}
                and we&apos;ll sort it out.
              </p>
            </div>
          </div>
        )}
        <section className="bg-gradient-to-b from-emerald-50 via-white to-white pb-4 pt-16 dark:from-emerald-950/30 dark:via-gray-950 dark:to-gray-950 sm:pt-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Pricing</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Pricing that respects a home business.</h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
              Start free with your full renewal timeline and in-app reminders. Upgrade to Pro when email reminders,
              unlimited tracking, and local rules would help. Cancel anytime.
            </p>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <PricingSection />
        </section>

        <section className="bg-gray-50 py-20 dark:bg-gray-900 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Pricing questions</h2>
            <div className="mt-10 space-y-3">
              {PRICING_FAQS.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-sm dark:border-gray-800 dark:bg-gray-950"
                >
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                    <span className="font-semibold">{f.q}</span>
                    <PlusIcon className="h-5 w-5 flex-none text-gray-400 transition-transform duration-200 group-open:rotate-45" />
                  </summary>
                  <p className="px-5 pb-5 text-gray-600 dark:text-gray-400">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-emerald-600 px-6 py-14 text-center shadow-xl dark:bg-emerald-700 sm:px-16">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Start with the Free plan today.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-emerald-50">
                Set up your timeline in about two minutes. Upgrade later if you ever need to.
              </p>
              <Link
                href="/signup"
                className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-white px-8 text-base font-semibold text-emerald-700 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-emerald-50 active:translate-y-0"
              >
                Get started free
              </Link>
              <p className="mt-4 text-sm text-emerald-100">No credit card required. Free plan included.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 bg-gray-50 py-12 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <div className="max-w-xs">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <HomeIcon className="h-5 w-5" />
                </span>
                <span className="text-lg font-extrabold tracking-tight">
                  Fam<span className="text-emerald-600 dark:text-emerald-400">Comply</span>
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                Renewal timelines for family child care providers.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <p className="text-sm font-semibold">Product</p>
                <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>
                    <Link href="/#features" className="hover:text-gray-900 dark:hover:text-white">Features</Link>
                  </li>
                  <li>
                    <Link href="/#how-it-works" className="hover:text-gray-900 dark:hover:text-white">How it works</Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="hover:text-gray-900 dark:hover:text-white">Pricing</Link>
                  </li>
                  <li>
                    <Link href="/#faq" className="hover:text-gray-900 dark:hover:text-white">FAQ</Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold">Account</p>
                <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>
                    <Link href="/login" className="hover:text-gray-900 dark:hover:text-white">Log in</Link>
                  </li>
                  <li>
                    <Link href="/signup" className="hover:text-gray-900 dark:hover:text-white">Create account</Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold">Support</p>
                <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>
                    <a href="mailto:support@zeroorigine.com" className="hover:text-gray-900 dark:hover:text-white">Contact us</a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-gray-200 pt-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400 sm:flex-row">
            <p>© {new Date().getFullYear()} FamComply. All rights reserved.</p>
            <p>Built with care for the people who care for kids.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
