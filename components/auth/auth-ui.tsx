'use client'

// CANONICAL: shared UI primitives for FamComply auth pages (login, signup,
// forgot-password, reset-password). One definition for the card, inputs,
// buttons, spinner, skeleton, and the lazy browser Supabase client.

import { createBrowserClient } from '@supabase/ssr'

export const CARD =
  'w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-emerald-900/5'
export const CARD_WIDE =
  'w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-emerald-900/5'
export const INPUT =
  'block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'
export const LABEL = 'mb-1.5 block text-sm font-medium text-slate-700'
export const BTN_PRIMARY =
  'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60'
export const BTN_SECONDARY =
  'inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]'
export const BTN_OAUTH =
  'inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60'

// Lazy client creation: nothing throws at module load time during the build.
export function getAuthSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    const missing = [
      !supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
      !supabaseAnonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]
      .filter(Boolean)
      .join(' and ')
    throw new Error(
      `Supabase auth is not configured: missing ${missing}. ` +
        'Add the variable(s) to your environment (e.g. .env.local) and restart the app.'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

export function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export function CardSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={wide ? CARD_WIDE : CARD}>
      <div className="animate-pulse space-y-4">
        <div className="h-7 w-2/3 rounded bg-slate-200" />
        <div className="h-4 w-full rounded bg-slate-100" />
        <div className="h-11 w-full rounded-lg bg-slate-100" />
        <div className="h-11 w-full rounded-lg bg-slate-100" />
        {wide && <div className="h-24 w-full rounded-xl bg-slate-100" />}
        <div className="h-11 w-full rounded-lg bg-slate-200" />
      </div>
    </div>
  )
}
