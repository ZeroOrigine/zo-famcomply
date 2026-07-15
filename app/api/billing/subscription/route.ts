// CANONICAL: read-only billing state for the signed-in user.
//
// CENTRAL PAYMENTS MODE: the central Stripe webhook writes billing rows into
// famcomply_subscriptions; this product only reads them. Reads run as the
// user through RLS (owner policy), and a database trigger blocks any client
// or authenticated-role write to billing tables, so no self-upgrades.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function getSupabaseForRequest() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null
  const cookieStore = cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      },
    },
  })
}

export async function GET() {
  const supabase = getSupabaseForRequest()
  if (!supabase) {
    return NextResponse.json({ error: "Billing isn't configured yet. Try again a little later." }, { status: 503 })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })
  }

  const { data: sub, error: subError } = await supabase
    .from('famcomply_subscriptions')
    .select('plan_slug, status, current_period_end, cancel_at_period_end, stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (subError) {
    console.error('billing/subscription: lookup failed', subError.message)
    return NextResponse.json(
      { error: 'We had trouble loading your plan. Refresh in a moment and it should be there.' },
      { status: 502 }
    )
  }

  // Every new user gets a free subscription row from the signup trigger.
  // If it is somehow missing, treat them as Free rather than erroring.
  const planSlug = sub?.plan_slug ?? 'free'

  const { data: plan, error: planError } = await supabase
    .from('famcomply_plans')
    .select('slug, name, description, price_monthly_cents, price_yearly_cents, features, allows_email_reminders, max_tracked_requirements')
    .eq('slug', planSlug)
    .maybeSingle()

  if (planError) {
    console.error('billing/subscription: plan lookup failed', planError.message)
  }

  const status = sub?.status ?? 'active'

  return NextResponse.json({
    subscription: {
      planSlug,
      status,
      currentPeriodEnd: sub?.current_period_end ?? null,
      cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
      hasBillingAccount: Boolean(sub?.stripe_customer_id),
    },
    plan: plan
      ? {
          slug: plan.slug,
          name: plan.name,
          description: plan.description,
          priceMonthlyCents: plan.price_monthly_cents,
          priceYearlyCents: plan.price_yearly_cents,
          features: plan.features,
          allowsEmailReminders: plan.allows_email_reminders,
          maxTrackedRequirements: plan.max_tracked_requirements,
        }
      : null,
    isPro: planSlug !== 'free' && (status === 'active' || status === 'trialing'),
  })
}
