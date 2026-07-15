// CANONICAL: plan entitlement resolution for FamComply.
//
// Split entry points (QA-038): server code resolves entitlements straight
// from the DB via getEntitlements/getEntitlementsForUsers; browser code goes
// through the thin client-safe wrapper getEntitlementsClient(), which calls
// /api/billing/subscription so client bundles never query tables directly.
// The famcomply_plans table is the source of truth for limits. This module reads
// subscription + plan and answers two questions: how many requirements may this
// user track, and do they get email reminders. Fails closed to the Free plan.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Entitlements {
  planSlug: string;
  planName: string;
  allowsEmailReminders: boolean;
  maxTrackedRequirements: number | null;
  subscriptionStatus: string;
}

interface SubscriptionRow {
  user_id: string;
  plan_slug: string;
  status: string;
}

interface PlanEntitlementRow {
  slug: string;
  name: string;
  allows_email_reminders: boolean;
  max_tracked_requirements: number | null;
}

const FREE_PLAN_FALLBACK: Omit<Entitlements, 'subscriptionStatus'> = {
  planSlug: 'free',
  planName: 'Free',
  allowsEmailReminders: false,
  maxTrackedRequirements: 6,
};

const PAID_ACCESS_STATUSES = ['active', 'trialing'] as const;

function resolveEntitlements(
  subscription: SubscriptionRow | null,
  planBySlug: Map<string, PlanEntitlementRow>
): Entitlements {
  const subscriptionStatus = subscription?.status ?? 'none';
  const hasPaidAccess =
    subscription !== null &&
    (PAID_ACCESS_STATUSES as readonly string[]).includes(subscription.status);
  const effectiveSlug = subscription !== null && hasPaidAccess ? subscription.plan_slug : 'free';

  const plan = planBySlug.get(effectiveSlug) ?? planBySlug.get('free') ?? null;
  if (plan === null) {
    return { ...FREE_PLAN_FALLBACK, subscriptionStatus };
  }

  return {
    planSlug: plan.slug,
    planName: plan.name,
    allowsEmailReminders: plan.allows_email_reminders,
    maxTrackedRequirements: plan.max_tracked_requirements,
    subscriptionStatus,
  };
}

// Batch lookup. Works with the user-scoped client (RLS narrows to own rows)
// and with the admin client (the daily cron resolves many users at once).
export async function getEntitlementsForUsers(
  client: SupabaseClient,
  userIds: string[]
): Promise<Map<string, Entitlements>> {
  const entitlementsByUser = new Map<string, Entitlements>();
  if (userIds.length === 0) {
    return entitlementsByUser;
  }

  const { data: subscriptionRows, error: subscriptionError } = await client
    .from('famcomply_subscriptions')
    .select('user_id, plan_slug, status')
    .in('user_id', userIds);
  if (subscriptionError) {
    console.error('[famcomply] entitlements subscription lookup failed:', subscriptionError);
  }

  const { data: planRows, error: planError } = await client
    .from('famcomply_plans')
    .select('slug, name, allows_email_reminders, max_tracked_requirements');
  if (planError) {
    console.error('[famcomply] entitlements plan lookup failed:', planError);
  }

  const subscriptions = (subscriptionRows ?? []) as SubscriptionRow[];
  const plans = (planRows ?? []) as PlanEntitlementRow[];
  const planBySlug = new Map(plans.map((plan) => [plan.slug, plan] as const));
  const subscriptionByUserId = new Map(
    subscriptions.map((row) => [row.user_id, row] as const)
  );

  for (const userId of userIds) {
    const subscription = subscriptionByUserId.get(userId) ?? null;
    entitlementsByUser.set(userId, resolveEntitlements(subscription, planBySlug));
  }

  return entitlementsByUser;
}

// Thin client-safe wrapper (QA-038): resolves entitlements through the
// /api/billing/subscription endpoint so browser code never queries
// famcomply_* tables directly. Auth rides on the session cookie, so no
// Supabase client or userId is needed. Fails closed to the Free plan.
export async function getEntitlementsClient(): Promise<Entitlements> {
  try {
    const response = await fetch('/api/billing/subscription', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      return { ...FREE_PLAN_FALLBACK, subscriptionStatus: 'none' };
    }
    const payload = (await response.json()) as Record<string, unknown>;
    const nested = payload.entitlements;
    const source = (
      typeof nested === 'object' && nested !== null ? nested : payload
    ) as Record<string, unknown>;
    const planSlug = source.planSlug ?? source.plan_slug;
    const planName = source.planName ?? source.plan_name;
    const allowsEmailReminders = source.allowsEmailReminders ?? source.allows_email_reminders;
    const maxTrackedRequirements =
      source.maxTrackedRequirements !== undefined
        ? source.maxTrackedRequirements
        : source.max_tracked_requirements;
    const subscriptionStatus =
      source.subscriptionStatus ?? source.subscription_status ?? source.status;
    return {
      planSlug: typeof planSlug === 'string' ? planSlug : FREE_PLAN_FALLBACK.planSlug,
      planName: typeof planName === 'string' ? planName : FREE_PLAN_FALLBACK.planName,
      allowsEmailReminders:
        typeof allowsEmailReminders === 'boolean'
          ? allowsEmailReminders
          : FREE_PLAN_FALLBACK.allowsEmailReminders,
      maxTrackedRequirements:
        typeof maxTrackedRequirements === 'number' || maxTrackedRequirements === null
          ? maxTrackedRequirements
          : FREE_PLAN_FALLBACK.maxTrackedRequirements,
      subscriptionStatus:
        typeof subscriptionStatus === 'string' ? subscriptionStatus : 'none',
    };
  } catch (error) {
    console.error('[famcomply] entitlements api lookup failed:', error);
    return { ...FREE_PLAN_FALLBACK, subscriptionStatus: 'none' };
  }
}

export async function getEntitlements(
  client: SupabaseClient,
  userId: string
): Promise<Entitlements> {
  // Client components historically called this with the browser Supabase
  // client; keep them working but route through the API wrapper so the
  // browser never issues direct table queries.
  if (typeof window !== 'undefined') {
    return getEntitlementsClient();
  }
  const entitlementsByUser = await getEntitlementsForUsers(client, [userId]);
  return (
    entitlementsByUser.get(userId) ?? { ...FREE_PLAN_FALLBACK, subscriptionStatus: 'none' }
  );
}
