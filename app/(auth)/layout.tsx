// CANONICAL: shared shell for FamComply auth pages (login, signup, password flows).
// This is a nested layout: fonts, globals and the <html> element come from the
// root layout owned by the core step. Each auth page renders its own card.
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Sign in | FamComply',
    template: '%s | FamComply',
  },
  description:
    'Sign in to FamComply to see your renewal timeline: CPR, first aid, background checks, training, inspection prep and license renewal, in the right order.',
}

function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="3" y="6" width="26" height="23" rx="6" fill="#059669" />
      <path d="M10 3v6M22 3v6" stroke="#065F46" strokeWidth="3" strokeLinecap="round" />
      <path d="m11.5 19.5 3.2 3.2 6.3-6.8" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-white font-sans text-slate-900">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-100 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-amber-50 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 transition hover:opacity-80">
          <LogoMark />
          <span className="font-display text-xl font-bold tracking-tight text-slate-900">FamComply</span>
        </Link>
        <Link href="/" className="text-sm font-medium text-slate-600 transition hover:text-emerald-700">
          Back to home
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:py-12">
        {children}
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-8 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
        <p>Renewals in the right order, for people who run child care at home.</p>
        <p className="mt-1">© {new Date().getFullYear()} FamComply</p>
      </footer>
    </div>
  )
}
