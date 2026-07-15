// CANONICAL: FamComply dashboard layout. Server-side auth check, then the shared
// shell (sidebar and mobile bars) around every signed-in page.
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getEntitlements } from '@/lib/db/entitlements'
import { DashboardNav } from '@/lib/core/nav'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    redirect('/login')
  }

  const user = data.user

  const { data: profileRow } = await supabase
    .from('famcomply_profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  const entitlements = await getEntitlements(supabase, user.id)

  const email = (profileRow?.email ?? user.email ?? '').trim()
  const fullName = (profileRow?.full_name ?? '').trim()
  const emailLocal = email.split('@')[0] ?? ''
  const displayLabel = fullName !== '' ? fullName : emailLocal !== '' ? emailLocal : 'Provider'
  const firstName = displayLabel.split(' ')[0] ?? displayLabel

  return (
    <div className="min-h-screen bg-slate-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-teal-800 focus:shadow-lg"
      >
        Skip to content
      </a>
      <DashboardNav
        firstName={firstName}
        email={email}
        planSlug={entitlements.planSlug}
        planName={entitlements.planName}
      />
      <div className="lg:pl-64">
        <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
          {children}
        </main>
      </div>
    </div>
  )
}
