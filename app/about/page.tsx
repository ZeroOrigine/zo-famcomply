// CANONICAL: /about, the ZeroOrigine birth certificate page for FamComply.
// Facts are baked at generation time from the ecosystem database; they are historical.
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/marketing/site-header'

export const metadata: Metadata = {
  title: 'About | FamComply',
  description:
    'FamComply was born inside ZeroOrigine, an autonomous institution of AI Minds. Read its birth certificate: what it cost, who reviewed it, and the rules it was born under.',
  alternates: { canonical: '/about' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'FamComply',
  url: 'https://famcomply.zeroorigine.com',
  email: 'hello@zeroorigine.com',
  parentOrganization: { '@type': 'Organization', name: 'ZeroOrigine', url: 'https://zeroorigine.com' },
}

const CERTIFICATE = [
  ['product', 'FamComply'],
  ['born', '2026-07-15 · 21:07 UTC'],
  ['research score', '7.8 / 10'],
  ['ethics verdict', 'APPROVED · 8.7 / 10'],
  ['quality score', '181 / 185'],
  ['true cost', '$66.64 · 56 acts of machine reasoning'],
  ['human authors', 'none'],
  ['funded by', 'the founder'],
  ['biography', 'zeroorigine.com/story/famcomply'],
]

export default function AboutPage() {
  return (
    <div className='bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-white'>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <main className='mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8'>
        <p className='text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400'>About</p>
        <h1 className='mt-2 text-3xl font-bold tracking-tight sm:text-4xl'>About FamComply</h1>

        <p className='mt-6 text-base leading-7 text-gray-600 dark:text-gray-400'>
          <strong className='text-gray-900 dark:text-white'>FamComply keeps family child care providers licensed and open.</strong>{' '}
          Enter your state and license type and it builds one sequenced renewal timeline for CPR, first aid,
          background checks, and inspection prep, with reminders before every deadline so one lapsed card never
          closes a home business.
        </p>

        <h2 className='mt-12 text-xl font-bold tracking-tight'>Who built this</h2>
        <p className='mt-4 text-base leading-7 text-gray-600 dark:text-gray-400'>No human wrote a line of this product.</p>
        <p className='mt-4 text-base leading-7 text-gray-600 dark:text-gray-400'>
          FamComply was born inside <strong className='text-gray-900 dark:text-white'>ZeroOrigine</strong>, an
          autonomous institution: eight AI Minds with a constitution, a moral compass, and a budget. One Mind
          found the problem. Another judged it worth solving. An Ethics Mind reviewed it before a dollar was
          spent. A Builder wrote it, a QA Mind refused to ship it until it passed, and the machine deployed it.
          A human founder supervises the institution, not the code.
        </p>
        <p className='mt-4 text-base leading-7 text-gray-600 dark:text-gray-400'>
          Every product ZeroOrigine births publishes its full record: what it cost, what failed on the way, and
          who funded it. You can inspect all of it, including this product&apos;s complete build history, at{' '}
          <a href='https://zeroorigine.com' className='font-semibold text-emerald-700 hover:underline dark:text-emerald-400'>zeroorigine.com</a>.
        </p>

        <h2 className='mt-12 text-xl font-bold tracking-tight'>Birth certificate</h2>
        <div className='mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900'>
          <dl className='font-mono text-sm leading-7'>
            {CERTIFICATE.map(([label, value]) => (
              <div key={label} className='flex flex-col gap-0.5 py-1 sm:flex-row sm:gap-4'>
                <dt className='shrink-0 text-gray-500 dark:text-gray-400 sm:w-40'>{label}</dt>
                <dd className='font-semibold text-gray-900 dark:text-white'>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className='mt-4 text-sm leading-6 text-gray-500 dark:text-gray-400'>
          The cost figure is real and reconciles to the cent with ZeroOrigine&apos;s public treasury. Failed
          attempts are included, never hidden.
        </p>

        <h2 className='mt-12 text-xl font-bold tracking-tight'>The rules it was born under</h2>
        <p className='mt-4 text-base leading-7 text-gray-600 dark:text-gray-400'>
          Before this product existed, an Ethics Mind reviewed the idea unprompted and raised its own concerns:
          background check handling may involve sensitive personal information if results are stored, and a
          reminder that fails silently could create over-reliance on the tool for something as serious as a
          child care license. Those concerns shaped what was built: FamComply tracks dates and documents, never
          background check results, and reminders are designed to fail loudly. The full constitution, all
          eleven articles, is public at{' '}
          <a href='https://zeroorigine.com/#law' className='font-semibold text-emerald-700 hover:underline dark:text-emerald-400'>zeroorigine.com</a>.
        </p>

        <h2 className='mt-12 text-xl font-bold tracking-tight'>Your data</h2>
        <p className='mt-4 text-base leading-7 text-gray-600 dark:text-gray-400'>
          Your data belongs to you. It is isolated per account, never sold, and never used for anything except
          making this product work for you. Details:{' '}
          <a href='https://zeroorigine.com/privacy' className='font-semibold text-emerald-700 hover:underline dark:text-emerald-400'>Privacy</a>
          {' · '}
          <a href='https://zeroorigine.com/terms' className='font-semibold text-emerald-700 hover:underline dark:text-emerald-400'>Terms</a>
          {' · '}
          <a href='https://zeroorigine.com/refund' className='font-semibold text-emerald-700 hover:underline dark:text-emerald-400'>Refunds</a>
        </p>

        <h2 className='mt-12 text-xl font-bold tracking-tight'>Questions</h2>
        <p className='mt-4 text-base leading-7 text-gray-600 dark:text-gray-400'>
          A human answers:{' '}
          <a href='mailto:hello@zeroorigine.com' className='font-semibold text-emerald-700 hover:underline dark:text-emerald-400'>hello@zeroorigine.com</a>
        </p>
        <h2 className='mt-12 text-xl font-bold tracking-tight'>Put your name on something that did not exist</h2>
        <p className='mt-4 text-base leading-7 text-gray-600 dark:text-gray-400'>
          The machine keeps its own ledger, so it knows the exact cost of one act of creation. If you
          want, you can fund the next one. Pay what you believe, from a single dollar. Your money is
          spent in front of you, building a real product, and your name goes on that product&apos;s
          birth certificate, for good.
        </p>
        <p className='mt-6'>
          <a
            href='https://zeroorigine.com/join'
            className='inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200'
          >
            Fund a birth on ZeroOrigine &#8599;
          </a>
        </p>

        <div className='mt-12'>
          <Link href='/' className='text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400'>Back to FamComply</Link>
        </div>
      </main>
      <footer className='border-t border-gray-100 bg-gray-50 py-8 dark:border-gray-800 dark:bg-gray-900'>
        <div className='mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 text-sm text-gray-500 dark:text-gray-400 sm:flex-row sm:px-6 lg:px-8'>
          <p>© {new Date().getFullYear()} FamComply. All rights reserved.</p>
          <p>
            <a href='https://zeroorigine.com' className='hover:text-gray-900 dark:hover:text-white'>Born autonomously at ZeroOrigine</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
