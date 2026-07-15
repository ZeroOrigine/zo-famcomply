'use client'

// CANONICAL: dashboard error boundary for FamComply.

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[famcomply] dashboard error boundary:', error)
  }, [error])

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span
        aria-hidden="true"
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 font-display text-xl font-bold text-rose-700"
      >
        !
      </span>
      <h1 className="mt-4 font-display text-xl font-bold text-slate-900">That page hit a snag</h1>
      <p className="mt-2 text-sm text-slate-600">
        Nothing is lost. Try again, and if it keeps happening, give it a minute and come back.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-800 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        Try again
      </button>
    </div>
  )
}
