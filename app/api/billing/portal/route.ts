// CANONICAL: billing portal entry point. CENTRAL PAYMENTS MODE.
//
// The central payments service owns the Stripe customer, so portal sessions
// are requested through the same proxy as checkout, with mode: "portal".
// This product never touches a Stripe key and never verifies signatures.
// If the proxy cannot produce a portal URL, we degrade with a calm message
// and nothing about the user's plan changes.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

const PRODUCT_SLUG = 'famcomply'

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

type PortalResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string; code: string }

async function openPortal(): Promise<PortalResult> {
  const supabase = getSupabaseForRequest()
  if (!supabase) {
    return { ok: false, status: 503, error: "Billing isn't configured yet. Try again a little later.", code: 'not_configured' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, status: 401, error: 'Please sign in to continue.', code: 'unauthenticated' }
  }

  const { data: sub } = await supabase
    .from('famcomply_subscriptions')
    .select('plan_slug, stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!sub || sub.plan_slug === 'free' || !sub.stripe_customer_id) {
    return {
      ok: false,
      status: 400,
      error: "You're on the Free plan, so there's no billing to manage yet. Upgrade to Pro whenever email reminders would help.",
      code: 'no_billing_account',
    }
  }

  const paymentsUrl = process.env.PAYMENTS_URL
  const proxyToken = process.env.PAYMENTS_PROXY_TOKEN
  if (!paymentsUrl || !proxyToken) {
    console.error('billing/portal: PAYMENTS_URL or PAYMENTS_PROXY_TOKEN is not set')
    return { ok: false, status: 503, error: "Billing settings aren't available right now. Try again a little later.", code: 'not_configured' }
  }

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
      body: JSON.stringify({ product_slug: PRODUCT_SLUG, user_id: user.id, mode: 'portal' }),
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (err) {
    console.error('billing/portal: payments proxy unreachable', err)
    return { ok: false, status: 502, error: 'We could not open your billing settings just now. Your plan is unchanged. Try again in a minute.', code: 'proxy_unreachable' }
  } finally {
    clearTimeout(timer)
  }

  if (!proxyRes.ok) {
    console.error('billing/portal: payments proxy returned', proxyRes.status)
    return { ok: false, status: 502, error: 'We could not open your billing settings just now. Your plan is unchanged. Try again in a minute.', code: 'proxy_error' }
  }

  let payload: { url?: unknown }
  try {
    payload = await proxyRes.json()
  } catch {
    return { ok: false, status: 502, error: 'We could not open your billing settings just now. Your plan is unchanged. Try again in a minute.', code: 'proxy_bad_response' }
  }

  if (typeof payload.url !== 'string' || !payload.url.startsWith('https://')) {
    return { ok: false, status: 502, error: 'We could not open your billing settings just now. Your plan is unchanged. Try again in a minute.', code: 'proxy_bad_url' }
  }

  return { ok: true, url: payload.url }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'That request came from somewhere unexpected, so we stopped it.' },
      { status: 403 }
    )
  }
  const result = await openPortal()
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
  }
  return NextResponse.json({ url: result.url })
}

// Link flow: <a href="/api/billing/portal"> works too. Signed-out visitors
// are sent to /login first by the middleware, then brought back here.
export async function GET(request: NextRequest) {
  const result = await openPortal()
  if (result.ok) {
    return NextResponse.redirect(result.url, { status: 303 })
  }
  if (result.code === 'unauthenticated') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', '/api/billing/portal')
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.redirect(new URL('/dashboard?billing=portal-unavailable', request.url))
}
