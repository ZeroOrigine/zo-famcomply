// CANONICAL: plan entitlement resolution for FamComply.
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

  for (const userId of userIds) {
    const subscription = subscriptions.find((row) => row.user_id === userId) ?? null;
    entitlementsByUser.set(userId, resolveEntitlements(subscription, planBySlug));
  }

  return entitlementsByUser;
}

export async function getEntitlements(
  client: SupabaseClient,
  userId: string
): Promise<Entitlements> {
  const entitlementsByUser = await getEntitlementsForUsers(client, [userId]);
  return (
    entitlementsByUser.get(userId) ?? { ...FREE_PLAN_FALLBACK, subscriptionStatus: 'none' }
  );
}
