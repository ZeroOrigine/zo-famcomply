'use client'

// CANONICAL: FamComply marketing site header. Single source of truth for the top navigation on marketing pages.
import { useState } from 'react'
import Link from 'next/link'

const LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/#faq', label: 'FAQ' },
]

function Mark() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-5 w-5"
      >
        <path d="M3 11l9-7 9 7 M5 10v10h14V10 M9.5 14.5l2 2 3.5-3.5" />
      </svg>
    </span>
  )
}

export default function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/70 bg-white/85 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="FamComply home" onClick={() => setOpen(false)} className="flex items-center gap-2">
          <Mark />
          <span className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">
            Fam<span className="text-emerald-600 dark:text-emerald-400">Comply</span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-emerald-700 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            Get started free
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Toggle menu"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-6 w-6"
          >
            {open ? <path d="M6 6l12 12 M18 6L6 18" /> : <path d="M4 7h16 M4 12h16 M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <nav
          aria-label="Mobile"
          className="border-t border-gray-100 bg-white px-4 pb-4 pt-2 dark:border-gray-800 dark:bg-gray-950 md:hidden"
        >
          {[...LINKS, { href: '/login', label: 'Log in' }].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex min-h-[44px] items-center rounded-lg px-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/signup"
            onClick={() => setOpen(false)}
            className="mt-2 flex h-12 items-center justify-center rounded-lg bg-emerald-600 text-base font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Get started free
          </Link>
          <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">No credit card required</p>
        </nav>
      )}
    </header>
  )
}
