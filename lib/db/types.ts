// CANONICAL: FamComply domain types, enum value lists, and explicit column selections.
// Shared by API routes, services, and server components. Column constants exist so
// no query ever uses select('*').

export const REQUIREMENT_KINDS = [
  'cpr_certification',
  'first_aid_certification',
  'background_check',
  'continuing_education',
  'inspection_prep',
  'license_renewal',
] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

export const REQUIREMENT_STATUSES = [
  'not_started',
  'on_track',
  'due_soon',
  'overdue',
  'completed',
] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const LICENSE_TYPES = [
  'family_child_care',
  'group_family_child_care',
  'large_family_child_care',
  'other',
] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number];

// Free-plan "in-app reminders" surface as dashboard status badges, not persisted
// reminder rows, so 'in_app' is intentionally NOT a reminder channel. Every reminder
// row created by famcomply_sync_reminders is an email reminder; keeping the channel
// list to what the code actually writes keeps the data model honest (QA-002).
export const REMINDER_CHANNELS = ['email'] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const REMINDER_STATUSES = ['pending', 'sent', 'canceled', 'failed'] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// 50 states, DC, and the territories that license family child care.
export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
  'WY', 'PR', 'VI', 'GU', 'AS', 'MP',
] as const;

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  state_code: string | null;
  license_type: LicenseType | null;
  license_number: string | null;
  timezone: string;
  role: 'provider' | 'admin';
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProviderRequirement {
  id: string;
  template_id: string | null;
  requirement_kind: RequirementKind;
  title: string;
  issued_on: string | null;
  expires_on: string | null;
  completed_on: string | null;
  status: RequirementStatus;
  sequence_order: number;
  lead_days: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  requirement_id: string;
  remind_on: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  sent_at: string | null;
  created_at: string;
}

export interface ReminderRequirementSummary {
  id: string;
  title: string;
  requirement_kind: RequirementKind;
  expires_on: string | null;
  status: RequirementStatus;
}

export interface ReminderWithRequirement extends Reminder {
  requirement: ReminderRequirementSummary | null;
}

export interface Plan {
  slug: string;
  name: string;
  description: string;
  price_monthly_cents: number;
  price_yearly_cents: number | null;
  features: string[];
  allows_email_reminders: boolean;
  max_tracked_requirements: number | null;
  sort_order: number;
}

// Explicit column lists. Collison rule: never select('*').
export const REQUIREMENT_COLUMNS =
  'id, template_id, requirement_kind, title, issued_on, expires_on, completed_on, status, sequence_order, lead_days, notes, created_at, updated_at';

export const PROFILE_COLUMNS =
  'id, email, full_name, state_code, license_type, license_number, timezone, role, onboarding_completed, created_at, updated_at';

export const REMINDER_COLUMNS =
  'id, requirement_id, remind_on, channel, status, sent_at, created_at';

export const PLAN_COLUMNS =
  'slug, name, description, price_monthly_cents, price_yearly_cents, features, allows_email_reminders, max_tracked_requirements, sort_order';
