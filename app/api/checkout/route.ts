// CANONICAL: FamComply checkout entry point. CENTRAL PAYMENTS MODE.
//
// This product holds NO Stripe key and imports no Stripe SDK. One central
// payments service owns the single Stripe key and the single webhook, and
// that webhook writes billing state back into famcomply_subscriptions and
// famcomply_payments. This route only does three things:
//   1. Authenticates the user with Supabase (RLS-backed user client).
//   2. Resolves the Stripe price id for the requested plan from the
//      famcomply_plans table (Deploy Mind sets the ids there), with an env
//      var fallback. Price ids are never hardcoded.
//   3. Asks the central proxy for a Checkout URL and hands it to the user.
//
// Proxy contract (multi-tenant ownership tag included as product_slug):
//   POST {PAYMENTS_URL}
//   Authorization: Bearer {PAYMENTS_PROXY_TOKEN}
//   { "product_slug": "famcomply", "price_id": "...", "user_id": "..." }
//   -> { "url": "https://checkout.stripe.com/..." }
//
// Required environment variables:
//   PAYMENTS_URL                  server only. Central payments proxy endpoint.
//   PAYMENTS_PROXY_TOKEN          server only. Bearer token for the proxy.
//   NEXT_PUBLIC_SUPABASE_URL      client safe. From zo_config.supabase_url.
//   NEXT_PUBLIC_SUPABASE_ANON_KEY client safe. From zo_config.supabase_anon_key.
// Optional fallbacks if famcomply_plans has no price ids yet:
//   STRIPE_PRICE_ID_PRO_MONTHLY, STRIPE_PRICE_ID_PRO_YEARLY
//
// Plans (must match the famcomply_plans seed exactly):
//   free: $0, in-app reminders, up to 6 tracked requirements. No checkout.
//   pro:  $9/month or $79/year, email reminders, unlimited requirements,
//         custom county and city rules.
//
// Rate limiting: apply a per-user edge limit here (about 10 requests/minute).
// Card data: never touches this server. Stripe Checkout handles PCI scope.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

const PRODUCT_SLUG = 'famcomply'
const INTERVALS = ['monthly', 'yearly'] as const
type Interval = (typeof INTERVALS)[number]

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

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === (request.headers.get('host') ?? request.nextUrl.host)
  } catch {
    return false
  }
}

type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string; code: string }

async function startCheckout(planInput: unknown, intervalInput: unknown): Promise<CheckoutResult> {
  // Server-side validation of everything the client sent.
  const plan = typeof planInput === 'string' && planInput ? planInput.toLowerCase() : 'pro'
  const interval = (typeof intervalInput === 'string' && intervalInput ? intervalInput.toLowerCase() : 'monthly') as Interval

  if (!/^[a-z0-9_-]{1,40}$/.test(plan)) {
    return { ok: false, status: 400, error: "That plan doesn't exist. Pick one from the pricing page.", code: 'bad_plan' }
  }
  if (!INTERVALS.includes(interval)) {
    return { ok: false, status: 400, error: 'Billing works monthly or yearly. Pick one of those two.', code: 'bad_interval' }
  }
  if (plan === 'free') {
    return { ok: false, status: 400, error: "The Free plan doesn't need a checkout. You're on it from day one.", code: 'free_plan' }
  }

  const supabase = getSupabaseForRequest()
  if (!supabase) {
    return { ok: false, status: 503, error: "Checkout isn't configured yet. Try again a little later.", code: 'not_configured' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, status: 401, error: 'Please sign in to upgrade.', code: 'unauthenticated' }
  }

  // Already subscribed to this plan? Say so instead of double-charging.
  const { data: sub } = await supabase
    .from('famcomply_subscriptions')
    .select('plan_slug, status')
    .eq('user_id', user.id)
    .maybeSingle()
  if (sub && sub.plan_slug === plan && (sub.status === 'active' || sub.status === 'trialing')) {
    return {
      ok: false,
      status: 409,
      error: "You're already on this plan. Manage or change it from your billing settings.",
      code: 'already_subscribed',
    }
  }

  // Price ids live in famcomply_plans (source of truth, set by the Deploy
  // Mind). Env vars are only a fallback. Nothing is hardcoded.
  const { data: planRow, error: planError } = await supabase
    .from('famcomply_plans')
    .select('slug, price_monthly_cents, stripe_price_id_monthly, stripe_price_id_yearly, is_active')
    .eq('slug', plan)
    .eq('is_active', true)
    .maybeSingle()

  if (planError) {
    console.error('checkout: plan lookup failed', planError.message)
    return { ok: false, status: 502, error: 'We had trouble looking up that plan. Nothing was charged. Try again in a minute.', code: 'plan_lookup_failed' }
  }
  if (!planRow) {
    return { ok: false, status: 404, error: "That plan doesn't exist. Pick one from the pricing page.", code: 'plan_not_found' }
  }
  if (planRow.price_monthly_cents === 0) {
    return { ok: false, status: 400, error: "The Free plan doesn't need a checkout. You're on it from day one.", code: 'free_plan' }
  }

  const envFallback = process.env[`STRIPE_PRICE_ID_${plan.toUpperCase()}_${interval.toUpperCase()}`]
  const priceId =
    (interval === 'yearly' ? planRow.stripe_price_id_yearly : planRow.stripe_price_id_monthly) || envFallback

  if (!priceId) {
    return {
      ok: false,
      status: 503,
      error: interval === 'yearly'
        ? "Yearly billing isn't available for that plan yet. Choose monthly, or check back soon."
        : "Checkout isn't set up for that plan yet. Try again a little later.",
      code: 'price_missing',
    }
  }

  const paymentsUrl = process.env.PAYMENTS_URL
  const proxyToken = process.env.PAYMENTS_PROXY_TOKEN
  if (!paymentsUrl || !proxyToken) {
    console.error('checkout: PAYMENTS_URL or PAYMENTS_PROXY_TOKEN is not set')
    return { ok: false, status: 503, error: "Checkout isn't configured yet. Try again a little later.", code: 'not_configured' }
  }

  // Call the central payments proxy. It owns the Stripe key; we never see it.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  let proxyRes: Response
  try {
    proxyRes = await fetch(paymentsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${proxyToken}`,
      },
      body: JSON.stringify({ product_slug: PRODUCT_SLUG, price_id: priceId, user_id: user.id }),
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (err) {
    console.error('checkout: payments proxy unreachable', err)
    return { ok: false, status: 502, error: 'Our payment service took too long to answer. Nothing was charged. Try again in a minute.', code: 'proxy_unreachable' }
  } finally {
    clearTimeout(timer)
  }

  if (!proxyRes.ok) {
    console.error('checkout: payments proxy returned', proxyRes.status)
    return { ok: false, status: 502, error: "Our payment service didn't accept that request. Nothing was charged. Try again in a minute.", code: 'proxy_error' }
  }

  let payload: { url?: unknown }
  try {
    payload = await proxyRes.json()
  } catch {
    return { ok: false, status: 502, error: 'Our payment service sent back something we could not read. Nothing was charged. Try again in a minute.', code: 'proxy_bad_response' }
  }

  // Only ever redirect to an https Stripe-hosted URL the proxy returned.
  if (typeof payload.url !== 'string' || !payload.url.startsWith('https://')) {
    return { ok: false, status: 502, error: 'Our payment service sent back something we could not read. Nothing was charged. Try again in a minute.', code: 'proxy_bad_url' }
  }

  return { ok: true, url: payload.url }
}

// JSON flow: the pricing page posts { plan, interval } and redirects to url.
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'That request came from somewhere unexpected, so we stopped it.' },
      { status: 403 }
    )
  }

  let body: { plan?: unknown; interval?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    // Empty body is fine: defaults to the Pro monthly plan.
  }

  const result = await startCheckout(body.plan, body.interval)
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
  }
  return NextResponse.json({ url: result.url })
}

// Link flow: <a href="/api/checkout?plan=pro&interval=monthly"> also works.
// Signed-out visitors are sent to /login first by the middleware, then back.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const result = await startCheckout(searchParams.get('plan'), searchParams.get('interval'))

  if (result.ok) {
    return NextResponse.redirect(result.url, { status: 303 })
  }
  if (result.code === 'unauthenticated') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }
  if (result.code === 'already_subscribed') {
    return NextResponse.redirect(new URL('/dashboard?billing=already-subscribed', request.url))
  }
  return NextResponse.redirect(new URL('/pricing?checkout=unavailable', request.url))
}
