// CANONICAL: FamComply marketing landing page (route "/"). Single source of truth for the homepage: hero, tracked-items strip, features, how it works, pricing anchor, real-life scenarios, FAQ, final CTA, footer.
// Copy rule: every claim here must match what the product ships. In-app reminders on Free; email reminders on Pro ($9/mo or $79/yr). No invented plans or features.
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/marketing/site-header'
import PricingSection from '@/components/marketing/pricing-section'

// #100: a descendant reads URL search params (useSearchParams); opt this
// route out of static generation so `next build` does not CSR-bail.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'FamComply | Renewal timelines for family child care providers',
  description:
    'Enter your state and license type. FamComply builds one sequenced renewal timeline for CPR, first aid, background checks, and inspection prep, with reminders before every deadline.',
  openGraph: {
    title: 'FamComply | Every child care renewal deadline on one timeline',
    description:
      'One sequenced renewal timeline for CPR, first aid, background checks, inspection prep, and your license renewal, with reminders before every deadline.',
    type: 'website',
    url: '/',
    siteName: 'FamComply',
  },
  twitter: {
    card: 'summary',
    title: 'FamComply | Renewal timelines for family child care providers',
    description:
      'One sequenced renewal timeline for CPR, first aid, background checks, inspection prep, and your license renewal.',
  },
  alternates: { canonical: '/' },
}

const BTN_PRIMARY =
  'inline-flex h-12 items-center justify-center rounded-xl bg-emerald-600 px-7 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-emerald-700 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600'
const BTN_SECONDARY =
  'inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-7 text-base font-semibold text-gray-800 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-gray-50 active:translate-y-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800'

const D = {
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3 2',
  sequence: 'M4 6h9 M4 12h13 M4 18h9 M18 15l3 3-3 3',
  bell: 'M6 9a6 6 0 0 1 12 0c0 6 2 8 2 8H4s2-2 2-8 M10.5 20a1.8 1.8 0 0 0 3 0',
  home: 'M3 10.5 12 3l9 7.5 M5 9.5V21h14V9.5 M9.5 21v-5.5h5V21',
  calendarCheck:
    'M8 2v4 M16 2v4 M3 9h18 M5 5h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z M9.5 14.5l2 2 3.5-4',
  alert: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 8v5 M12 16.5h.01',
  hourglass: 'M7 3h10 M7 21h10 M8 3v3l4 4 4-4V3 M8 21v-3l4-4 4 4v3',
  clipboard:
    'M9 4h6v3H9z M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2 M9 12h6 M9 16h4',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M8.5 12.5l2.5 2.5 4.5-5',
  circle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  check: 'M20 6 9 17l-5-5',
  plus: 'M12 5v14 M5 12h14',
}

function Svg({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? 'h-6 w-6'}
    >
      <path d={d} />
    </svg>
  )
}

const TRACKED = ['CPR certification', 'First aid', 'Background checks', 'Inspection prep', 'License renewal']

const FEATURES = [
  {
    icon: D.pin,
    title: 'Your state, your license',
    desc: 'Pick your state and license type during setup. Your timeline is built from that license\u2019s renewal requirements.',
  },
  {
    icon: D.clock,
    title: 'Every credential, one clock',
    desc: 'CPR, first aid, background checks, and inspection prep share one timeline with your license renewal. Five calendars become one.',
  },
  {
    icon: D.sequence,
    title: 'Steps in the right order',
    desc: 'Sequence-aware planning puts slow steps early, so a background check that takes weeks never stalls your renewal packet.',
  },
  {
    icon: D.bell,
    title: 'Reminders before deadlines',
    desc: 'Dashboard reminders on every plan, and email reminders on Pro land in your inbox ahead of each due date. A lapse should never be how you find out.',
  },
  {
    icon: D.home,
    title: 'Made for one-person businesses',
    desc: 'You are the director, the teacher, and the cook. Setup takes about two minutes and upkeep stays light.',
  },
  {
    icon: D.calendarCheck,
    title: 'Your year at a glance',
    desc: 'See what\u2019s done, what\u2019s next, and what\u2019s still months away, all on one screen.',
  },
]

const STEPS = [
  {
    title: 'Answer two questions',
    desc: 'Your state and your license type. That\u2019s the whole setup.',
  },
  {
    title: 'Get your sequenced timeline',
    desc: 'FamComply lays out CPR, first aid, background checks, inspection prep, and your renewal window in the order they need to happen.',
  },
  {
    title: 'Let the reminders work',
    desc: 'A reminder lands before each deadline, on your dashboard on every plan and in your inbox on Pro. Handle the step, check it off, and get back to the kids.',
  },
]

const SCENARIOS = [
  {
    icon: D.alert,
    title: 'The quietly expired CPR card',
    body: 'It\u2019s 9 p.m. and you just noticed your CPR certification expired two months ago, right in the middle of your license year.',
    fix: 'CPR sits on your timeline with reminders weeks ahead, so the class happens before the card runs out.',
  },
  {
    icon: D.hourglass,
    title: 'The background check bottleneck',
    body: 'Your renewal packet is due soon, but a background check for a new household member is still processing, and it takes as long as it takes.',
    fix: 'Sequence-aware ordering starts slow steps early, ahead of the paperwork that depends on them.',
  },
  {
    icon: D.clipboard,
    title: 'The inspection scramble',
    body: 'The inspector comes Thursday. You\u2019re up late with a flashlight, checking outlet covers and the fire extinguisher tag.',
    fix: 'Inspection prep lands on your timeline ahead of the visit, broken into small steps instead of one long night.',
  },
]

const FAQS = [
  {
    q: 'Is the Free plan actually free?',
    a: 'Yes. Your full state-based renewal sequence with all 6 core requirements, in-app reminders on your dashboard, and up to 6 tracked items, free for good. No credit card and no trial clock. Pro ($9 per month or $79 per year) adds email reminders, unlimited tracked requirements, and custom county and city rules.',
  },
  {
    q: 'Which states and license types are covered?',
    a: 'FamComply is built for licensed family child care and home daycare in the US. You pick your state and license type during setup, and your timeline is built from that license\u2019s renewal requirements. Every item is editable, so you can match it to what your licensor tells you.',
  },
  {
    q: 'Does FamComply file anything with my state?',
    a: 'No. FamComply organizes your deadlines and requirements so nothing lapses. You still submit renewals and forms the way your state requires.',
  },
  {
    q: 'Is my information safe?',
    a: 'Yes. Your account is protected, your data stays scoped to you alone, and connections are encrypted. We never sell your information.',
  },
  {
    q: 'Can I change or cancel plans later?',
    a: 'Yes. Upgrade, downgrade, or cancel from your account whenever you like. Downgrading moves you to the Free plan and keeps your timeline running.',
  },
  {
    q: 'What happens to my data if I leave?',
    a: 'Your timeline stays readable on the Free plan. If you want a copy of your data, email support@zeroorigine.com and we\u2019ll send it to you. You can also ask us to delete everything.',
  },
]

const EXAMPLE_ROWS: { label: string; status: string; chip: string }[] = [
  { label: 'Annual training hours', status: 'done', chip: 'Done' },
  { label: 'CPR and first aid renewal', status: 'soon', chip: '3 weeks left' },
  { label: 'Background check, new household member', status: 'queued', chip: '8 weeks out' },
  { label: 'Fire and health inspection prep', status: 'queued', chip: '3 months out' },
  { label: 'License renewal application', status: 'queued', chip: 'Opens in 4 months' },
]

const STATUS_ICON: Record<string, string> = {
  done: D.checkCircle,
  soon: D.bell,
  queued: D.circle,
}

const STATUS_ICON_COLOR: Record<string, string> = {
  done: 'text-emerald-600 dark:text-emerald-400',
  soon: 'text-amber-600 dark:text-amber-400',
  queued: 'text-gray-300 dark:text-gray-600',
}

const CHIP_STYLES: Record<string, string> = {
  done: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  soon: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  queued: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{children}</p>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <style>{`@keyframes fcRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@media (prefers-reduced-motion: no-preference){.fc-rise{animation:fcRise .7s cubic-bezier(.22,1,.36,1) both}.fc-d1{animation-delay:.1s}.fc-d2{animation-delay:.2s}.fc-d3{animation-delay:.3s}}`}</style>
      <SiteHeader />
      <main>
        {/* HERO */}
        <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-white dark:from-emerald-950/30 dark:via-gray-950 dark:to-gray-950">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
            <div>
              <span className="fc-rise inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Svg d={D.home} className="h-3.5 w-3.5" />
                Built for family child care and home daycare providers
              </span>
              <h1 className="fc-rise fc-d1 mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                Stop juggling CPR, background checks, and license renewals.
              </h1>
              <p className="fc-rise fc-d2 mt-6 max-w-xl text-lg text-gray-600 dark:text-gray-300">
                Tell FamComply your state and license type. It builds one sequenced timeline for CPR, first aid,
                background checks, inspection prep, and your license renewal, then reminds you before every deadline.
              </p>
              <div className="fc-rise fc-d3 mt-8 flex flex-wrap items-center gap-4">
                <Link href="/signup" className={BTN_PRIMARY}>
                  Get started free
                </Link>
                <Link href="/#how-it-works" className={BTN_SECONDARY}>
                  See how it works
                </Link>
              </div>
              <p className="fc-rise fc-d3 mt-3 text-sm text-gray-500 dark:text-gray-400">
                No credit card required. The Free plan covers your core timeline for good.
              </p>
              <div className="fc-rise fc-d3 mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
                {['Sequence-aware timeline', 'Reminders before every deadline', 'Made for one-person programs'].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <Svg d={D.check} className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Example timeline preview */}
            <div className="fc-rise fc-d2 relative">
              <div aria-hidden="true" className="absolute -right-8 -top-10 h-56 w-56 rounded-full bg-emerald-200/50 blur-3xl dark:bg-emerald-900/30" />
              <div aria-hidden="true" className="absolute -bottom-12 -left-8 h-56 w-56 rounded-full bg-amber-200/40 blur-3xl dark:bg-amber-900/20" />
              <div className="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-900 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Renewal timeline</p>
                    <p className="mt-0.5 text-sm font-bold sm:text-base">Texas · Registered Child-Care Home</p>
                  </div>
                  <span className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">Example</span>
                </div>
                <ul className="mt-4 space-y-2.5">
                  {EXAMPLE_ROWS.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/40"
                    >
                      <Svg d={STATUS_ICON[row.status]} className={`h-5 w-5 flex-none ${STATUS_ICON_COLOR[row.status]}`} />
                      <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{row.label}</span>
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${CHIP_STYLES[row.status]}`}>
                        {row.chip}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3.5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <Svg d={D.bell} className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Next reminder: 7 days before the CPR due date
                </div>
              </div>
              <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
                An example for a registered child care home in Texas. Yours is built from your state and license type.
              </p>
            </div>
          </div>
        </section>

        {/* TRACKED ITEMS STRIP */}
        <section aria-label="What FamComply tracks" className="border-y border-gray-100 bg-gray-50 py-10 dark:border-gray-800 dark:bg-gray-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
              One timeline that keeps watch over
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {TRACKED.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="scroll-mt-24 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>Features</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Your whole renewal cycle, handled.</h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                A license year has a lot of moving parts. FamComply keeps every one of them visible, ordered, and reminded.
              </p>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-gray-200 bg-white p-6 transition-shadow duration-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <Svg d={f.icon} className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="scroll-mt-24 bg-gray-50 py-20 dark:bg-gray-900 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Two questions. One plan. Zero surprises.</h2>
            </div>
            <div className="relative mt-14">
              <div
                aria-hidden="true"
                className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent dark:via-emerald-800 md:block"
              />
              <ol className="grid grid-cols-1 gap-12 md:grid-cols-3">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="relative flex flex-col items-center text-center md:px-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white shadow-md ring-8 ring-gray-50 dark:ring-gray-900">
                      {i + 1}
                    </span>
                    <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">{s.desc}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="scroll-mt-24 py-20 sm:py-24">
          <div className="mx-auto mb-12 max-w-2xl px-4 text-center sm:px-6">
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Simple pricing for a home business.</h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
              Every plan includes the sequenced timeline and dashboard reminders. The Free plan covers your core
              requirements, free for good.
            </p>
          </div>
          <PricingSection />
        </section>

        {/* SCENARIOS (real compliance moments, no invented endorsements) */}
        <section className="bg-gray-50 py-20 dark:bg-gray-900 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>Why it exists</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">The nights FamComply was built for.</h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                If you run a home program, you have probably lived at least one of these.
              </p>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
              {SCENARIOS.map((s) => (
                <div
                  key={s.title}
                  className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                    <Svg d={s.icon} className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 flex-1 text-gray-600 dark:text-gray-400">{s.body}</p>
                  <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
                    <p className="flex items-start gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      <Svg d={D.checkCircle} className="h-5 w-5 flex-none" />
                      <span>{s.fix}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <Eyebrow>FAQ</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Questions, answered.</h2>
            </div>
            <div className="mt-10 space-y-3">
              {FAQS.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-sm dark:border-gray-800 dark:bg-gray-900"
                >
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                    <span className="font-semibold">{f.q}</span>
                    <Svg
                      d={D.plus}
                      className="h-5 w-5 flex-none text-gray-400 transition-transform duration-200 group-open:rotate-45"
                    />
                  </summary>
                  <p className="px-5 pb-5 text-gray-600 dark:text-gray-400">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="pb-20 sm:pb-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-emerald-600 px-6 py-16 text-center shadow-xl dark:bg-emerald-700 sm:px-16">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Your next deadline is closer than you think.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-emerald-50">
                Set up your timeline in about two minutes and let FamComply keep watch over the renewals that keep your
                doors open.
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

      {/* FOOTER */}
      <footer className="border-t border-gray-100 bg-gray-50 py-12 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <div className="max-w-xs">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <Svg d={D.home} className="h-5 w-5" />
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
                  <li>
                    <Link href="/about" className="hover:text-gray-900 dark:hover:text-white">About</Link>
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
            <p>Built with care for the people who care for kids. · <a href="https://zeroorigine.com" className="hover:text-gray-900 dark:hover:text-white">Born autonomously at ZeroOrigine</a></p>
          </div>
        </div>
      </footer>
    </div>
  )
}
