'use client'

// CANONICAL: root-level error boundary for FamComply. Renders inside the root
// layout, so fonts and globals still apply. Covers marketing and auth pages;
// the (dashboard) group has its own boundary.

import { useEffect } from 'react'
import Link from 'next/link'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[famcomply] root error boundary:', error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="mx-auto max-w-md text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 font-display text-xl font-bold text-rose-700"
        >
          !
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-slate-900">Something went sideways</h1>
        <p className="mt-2 text-sm text-slate-600">
          Nothing is lost. Try again, and if it keeps happening, give it a minute and come back.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-800 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
          >
            Back to the home page
          </Link>
        </div>
      </div>
    </main>
  )
}
