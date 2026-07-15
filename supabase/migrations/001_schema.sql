-- ============================================================================
-- FamComply - PostgreSQL schema for Supabase (shared ZeroOrigine database)
-- All objects are prefixed with famcomply_ (tables, enums, functions, triggers)
-- Kernel: state + license type -> sequenced renewal timeline -> reminders.
-- Executable top-to-bottom on a fresh Supabase project.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUMS
-- ----------------------------------------------------------------------------
CREATE TYPE public.famcomply_user_role AS ENUM ('provider', 'admin');

CREATE TYPE public.famcomply_license_type AS ENUM (
  'family_child_care',
  'group_family_child_care',
  'large_family_child_care',
  'other'
);

CREATE TYPE public.famcomply_requirement_kind AS ENUM (
  'cpr_certification',
  'first_aid_certification',
  'background_check',
  'continuing_education',
  'inspection_prep',
  'license_renewal'
);

CREATE TYPE public.famcomply_requirement_status AS ENUM (
  'not_started',
  'on_track',
  'due_soon',
  'overdue',
  'completed'
);

CREATE TYPE public.famcomply_reminder_channel AS ENUM ('email', 'in_app');

CREATE TYPE public.famcomply_reminder_status AS ENUM ('pending', 'sent', 'canceled', 'failed');

CREATE TYPE public.famcomply_subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'canceled',
  'incomplete', 'incomplete_expired', 'unpaid', 'paused'
);

CREATE TYPE public.famcomply_payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- ----------------------------------------------------------------------------
-- 2. SHARED UTILITY: updated_at maintenance
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.famcomply_update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. TABLES
-- ----------------------------------------------------------------------------

-- 3.1 Profiles: extends auth.users with the provider's licensing context.
CREATE TABLE public.famcomply_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text NOT NULL DEFAULT '',
  state_code text CHECK (state_code IS NULL OR state_code ~ '^[A-Z]{2}$'),
  license_type public.famcomply_license_type,
  license_number text,
  timezone text NOT NULL DEFAULT 'America/New_York',
  role public.famcomply_user_role NOT NULL DEFAULT 'provider',
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.famcomply_profiles IS
  'One row per user. state_code + license_type drive timeline generation.';

-- 3.2 Requirement templates: curated reference data per state and license type.
--     state_code = ''ALL'' rows are the national baseline; state rows override them.
--     license_type NULL means the row applies to every license type in that state.
CREATE TABLE public.famcomply_requirement_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code text NOT NULL CHECK (state_code ~ '^[A-Z]{2}$' OR state_code = 'ALL'),
  license_type public.famcomply_license_type,
  requirement_kind public.famcomply_requirement_kind NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  renewal_interval_months integer NOT NULL CHECK (renewal_interval_months > 0),
  sequence_order integer NOT NULL DEFAULT 0 CHECK (sequence_order >= 0),
  lead_days integer NOT NULL DEFAULT 60 CHECK (lead_days >= 0),
  reminder_offsets_days integer[] NOT NULL DEFAULT '{60,30,14,7,1}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.famcomply_requirement_templates IS
  'Reference data: which requirements exist, their renewal cycle, and their order in the sequence.';

-- 3.3 Provider requirements: the user's own tracked timeline items.
CREATE TABLE public.famcomply_provider_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL DEFAULT 'famcomply' CHECK (product_id = 'famcomply'),
  template_id uuid REFERENCES public.famcomply_requirement_templates(id) ON DELETE SET NULL,
  requirement_kind public.famcomply_requirement_kind NOT NULL,
  title text NOT NULL,
  issued_on date,
  expires_on date,
  completed_on date,
  status public.famcomply_requirement_status NOT NULL DEFAULT 'not_started',
  sequence_order integer NOT NULL DEFAULT 0,
  lead_days integer NOT NULL DEFAULT 60 CHECK (lead_days >= 0),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.famcomply_provider_requirements IS
  'User-owned timeline items. template_id NULL means a custom requirement (county or city rule).';

-- 3.4 Reminders: the concrete send schedule the daily cron works from.
CREATE TABLE public.famcomply_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL DEFAULT 'famcomply' CHECK (product_id = 'famcomply'),
  requirement_id uuid NOT NULL REFERENCES public.famcomply_provider_requirements(id) ON DELETE CASCADE,
  remind_on date NOT NULL,
  channel public.famcomply_reminder_channel NOT NULL DEFAULT 'email',
  status public.famcomply_reminder_status NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requirement_id, remind_on, channel)
);
COMMENT ON TABLE public.famcomply_reminders IS
  'Auto-generated from expires_on and template offsets. Cron sends rows where status = pending and remind_on <= today.';

-- 3.5 Plans: pricing lookup. Limits here are the source of truth for entitlements.
CREATE TABLE public.famcomply_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_monthly_cents integer NOT NULL DEFAULT 0 CHECK (price_monthly_cents >= 0),
  price_yearly_cents integer CHECK (price_yearly_cents IS NULL OR price_yearly_cents >= 0),
  stripe_price_id_monthly text,
  stripe_price_id_yearly text,
  features text[] NOT NULL DEFAULT '{}',
  allows_email_reminders boolean NOT NULL DEFAULT false,
  max_tracked_requirements integer CHECK (max_tracked_requirements IS NULL OR max_tracked_requirements > 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.6 Subscriptions: Stripe billing state, one row per user, written by the webhook.
CREATE TABLE public.famcomply_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL DEFAULT 'famcomply' CHECK (product_id = 'famcomply'),
  plan_slug text NOT NULL DEFAULT 'free' REFERENCES public.famcomply_plans(slug),
  status public.famcomply_subscription_status NOT NULL DEFAULT 'active',
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.7 Payments: one-time charges (Stripe payment intents), written by the webhook.
CREATE TABLE public.famcomply_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL DEFAULT 'famcomply' CHECK (product_id = 'famcomply'),
  stripe_payment_intent_id text UNIQUE,
  stripe_checkout_session_id text,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  status public.famcomply_payment_status NOT NULL DEFAULT 'pending',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.8 Stripe events: webhook idempotency ledger. Service role only.
CREATE TABLE public.famcomply_stripe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX famcomply_profiles_email_idx
  ON public.famcomply_profiles (email);
CREATE INDEX famcomply_profiles_state_license_idx
  ON public.famcomply_profiles (state_code, license_type);

CREATE UNIQUE INDEX famcomply_requirement_templates_scope_key
  ON public.famcomply_requirement_templates (state_code, requirement_kind, COALESCE(license_type::text, 'all'));
CREATE INDEX famcomply_requirement_templates_lookup_idx
  ON public.famcomply_requirement_templates (state_code, license_type);

CREATE INDEX famcomply_provider_requirements_user_idx
  ON public.famcomply_provider_requirements (user_id);
CREATE INDEX famcomply_provider_requirements_user_status_idx
  ON public.famcomply_provider_requirements (user_id, status);
CREATE INDEX famcomply_provider_requirements_template_idx
  ON public.famcomply_provider_requirements (template_id);
CREATE INDEX famcomply_provider_requirements_open_expiry_idx
  ON public.famcomply_provider_requirements (expires_on)
  WHERE completed_on IS NULL;

CREATE INDEX famcomply_reminders_user_idx
  ON public.famcomply_reminders (user_id);
CREATE INDEX famcomply_reminders_requirement_idx
  ON public.famcomply_reminders (requirement_id);
CREATE INDEX famcomply_reminders_due_idx
  ON public.famcomply_reminders (remind_on)
  WHERE status = 'pending'::public.famcomply_reminder_status;

CREATE INDEX famcomply_subscriptions_customer_idx
  ON public.famcomply_subscriptions (stripe_customer_id);
CREATE INDEX famcomply_subscriptions_plan_idx
  ON public.famcomply_subscriptions (plan_slug);
CREATE INDEX famcomply_subscriptions_active_period_idx
  ON public.famcomply_subscriptions (current_period_end)
  WHERE status = 'active'::public.famcomply_subscription_status;

CREATE INDEX famcomply_payments_user_idx
  ON public.famcomply_payments (user_id);
CREATE INDEX famcomply_payments_status_idx
  ON public.famcomply_payments (status);

CREATE INDEX famcomply_plans_active_idx
  ON public.famcomply_plans (sort_order)
  WHERE is_active;

CREATE INDEX famcomply_stripe_events_type_idx
  ON public.famcomply_stripe_events (event_type);

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE public.famcomply_profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.famcomply_requirement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.famcomply_provider_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.famcomply_reminders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.famcomply_plans                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.famcomply_subscriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.famcomply_payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.famcomply_stripe_events         ENABLE ROW LEVEL SECURITY;
-- famcomply_stripe_events intentionally has NO policies: service role only.

-- Admin check. SECURITY DEFINER so it can read profiles without RLS recursion.
CREATE OR REPLACE FUNCTION public.famcomply_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.famcomply_profiles
    WHERE id = auth.uid()
      AND role = 'admin'::public.famcomply_user_role
  );
$$;
GRANT EXECUTE ON FUNCTION public.famcomply_is_admin() TO authenticated, service_role;

-- Profiles: keyed by id = auth.uid()
CREATE POLICY "famcomply_profiles_owner" ON public.famcomply_profiles FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
CREATE POLICY "famcomply_profiles_admin_read" ON public.famcomply_profiles FOR SELECT TO authenticated
  USING (public.famcomply_is_admin());

-- Reference tables: readable by signed-in users, writable by admins.
CREATE POLICY "famcomply_requirement_templates_read" ON public.famcomply_requirement_templates FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "famcomply_requirement_templates_admin_write" ON public.famcomply_requirement_templates FOR ALL TO authenticated
  USING (public.famcomply_is_admin())
  WITH CHECK (public.famcomply_is_admin());

CREATE POLICY "famcomply_plans_read" ON public.famcomply_plans FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "famcomply_plans_admin_write" ON public.famcomply_plans FOR ALL TO authenticated
  USING (public.famcomply_is_admin())
  WITH CHECK (public.famcomply_is_admin());

-- User-owned tables: canonical tenant isolation policy.
CREATE POLICY "famcomply_provider_requirements_owner" ON public.famcomply_provider_requirements FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'famcomply')
  WITH CHECK (user_id = auth.uid() AND product_id = 'famcomply');

CREATE POLICY "famcomply_reminders_owner" ON public.famcomply_reminders FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'famcomply')
  WITH CHECK (user_id = auth.uid() AND product_id = 'famcomply');

CREATE POLICY "famcomply_subscriptions_owner" ON public.famcomply_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'famcomply')
  WITH CHECK (user_id = auth.uid() AND product_id = 'famcomply');
CREATE POLICY "famcomply_subscriptions_admin_read" ON public.famcomply_subscriptions FOR SELECT TO authenticated
  USING (public.famcomply_is_admin());

CREATE POLICY "famcomply_payments_owner" ON public.famcomply_payments FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'famcomply')
  WITH CHECK (user_id = auth.uid() AND product_id = 'famcomply');
CREATE POLICY "famcomply_payments_admin_read" ON public.famcomply_payments FOR SELECT TO authenticated
  USING (public.famcomply_is_admin());

-- Billing hardening: browser sessions can read billing rows via RLS, but only
-- server contexts (service role, auth admin, migrations) may write them.
-- This closes the self-upgrade hole without changing the canonical policies.
CREATE OR REPLACE FUNCTION public.famcomply_block_client_billing_writes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    RAISE EXCEPTION 'Billing records are managed by the server';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER famcomply_subscriptions_block_client_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.famcomply_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.famcomply_block_client_billing_writes();

CREATE TRIGGER famcomply_payments_block_client_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.famcomply_payments
  FOR EACH ROW EXECUTE FUNCTION public.famcomply_block_client_billing_writes();

-- ----------------------------------------------------------------------------
-- 6. DOMAIN FUNCTIONS AND TRIGGERS
-- ----------------------------------------------------------------------------

-- 6.1 Status derivation: one definition, used by trigger and cron refresh.
CREATE OR REPLACE FUNCTION public.famcomply_derive_requirement_status(
  p_expires_on date,
  p_lead_days integer,
  p_completed_on date
)
RETURNS public.famcomply_requirement_status
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_completed_on IS NOT NULL THEN 'completed'::public.famcomply_requirement_status
    WHEN p_expires_on IS NULL THEN 'not_started'::public.famcomply_requirement_status
    WHEN p_expires_on < current_date THEN 'overdue'::public.famcomply_requirement_status
    WHEN p_expires_on <= current_date + COALESCE(p_lead_days, 60) THEN 'due_soon'::public.famcomply_requirement_status
    ELSE 'on_track'::public.famcomply_requirement_status
  END;
$$;

CREATE OR REPLACE FUNCTION public.famcomply_set_requirement_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.status := public.famcomply_derive_requirement_status(NEW.expires_on, NEW.lead_days, NEW.completed_on);
  RETURN NEW;
END;
$$;

CREATE TRIGGER famcomply_provider_requirements_status
  BEFORE INSERT OR UPDATE ON public.famcomply_provider_requirements
  FOR EACH ROW EXECUTE FUNCTION public.famcomply_set_requirement_status();

-- 6.2 Reminder sync: whenever an expiry date changes, rebuild the pending
--     reminder schedule from the template offsets (or sensible defaults).
CREATE OR REPLACE FUNCTION public.famcomply_sync_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_offsets integer[];
BEGIN
  DELETE FROM famcomply_reminders
  WHERE requirement_id = NEW.id
    AND status = 'pending'::famcomply_reminder_status;

  IF NEW.expires_on IS NULL OR NEW.completed_on IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT rt.reminder_offsets_days INTO v_offsets
  FROM famcomply_requirement_templates rt
  WHERE rt.id = NEW.template_id;

  v_offsets := COALESCE(v_offsets, ARRAY[60, 30, 14, 7, 1]);

  INSERT INTO famcomply_reminders (user_id, requirement_id, remind_on, channel, status)
  SELECT NEW.user_id,
         NEW.id,
         NEW.expires_on - offs.offset_days,
         'email'::famcomply_reminder_channel,
         'pending'::famcomply_reminder_status
  FROM unnest(v_offsets) AS offs(offset_days)
  WHERE NEW.expires_on - offs.offset_days >= current_date
  ON CONFLICT (requirement_id, remind_on, channel) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER famcomply_provider_requirements_sync_reminders
  AFTER INSERT OR UPDATE OF expires_on, completed_on ON public.famcomply_provider_requirements
  FOR EACH ROW EXECUTE FUNCTION public.famcomply_sync_reminders();

-- 6.3 Timeline generation: the kernel. Instantiates the user's sequenced
--     timeline from templates, preferring state-specific rows over the
--     national baseline, skipping kinds the user already tracks.
CREATE OR REPLACE FUNCTION public.famcomply_generate_timeline()
RETURNS SETOF public.famcomply_provider_requirements
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_state text;
  v_license famcomply_license_type;
BEGIN
  SELECT state_code, license_type INTO v_state, v_license
  FROM famcomply_profiles
  WHERE id = auth.uid();

  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Add your state to your profile first, then we can build your timeline';
  END IF;

  RETURN QUERY
  INSERT INTO famcomply_provider_requirements
    (user_id, template_id, requirement_kind, title, sequence_order, lead_days)
  SELECT auth.uid(), t.id, t.requirement_kind, t.title, t.sequence_order, t.lead_days
  FROM (
    SELECT DISTINCT ON (rt.requirement_kind) rt.*
    FROM famcomply_requirement_templates rt
    WHERE rt.state_code IN (v_state, 'ALL')
      AND (rt.license_type IS NULL OR rt.license_type = v_license)
    ORDER BY rt.requirement_kind,
             CASE WHEN rt.state_code = v_state THEN 0 ELSE 1 END,
             CASE WHEN rt.license_type = v_license THEN 0 ELSE 1 END
  ) t
  WHERE NOT EXISTS (
    SELECT 1
    FROM famcomply_provider_requirements pr
    WHERE pr.user_id = auth.uid()
      AND pr.requirement_kind = t.requirement_kind
  )
  RETURNING *;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.famcomply_generate_timeline() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.famcomply_generate_timeline() TO authenticated, service_role;

-- 6.4 Daily status refresh: called by the cron (service role) so statuses
--     stay honest as calendar days pass. Returns the number of rows changed.
CREATE OR REPLACE FUNCTION public.famcomply_refresh_requirement_statuses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE famcomply_provider_requirements
     SET status = famcomply_derive_requirement_status(expires_on, lead_days, completed_on)
   WHERE status IS DISTINCT FROM famcomply_derive_requirement_status(expires_on, lead_days, completed_on);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.famcomply_refresh_requirement_statuses() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.famcomply_refresh_requirement_statuses() TO service_role;

-- 6.5 New user handler: auto-create profile and free subscription.
--     Never blocks signup for the shared auth.users table.
CREATE OR REPLACE FUNCTION public.famcomply_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.famcomply_profiles (id, email, full_name, state_code, license_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN NEW.raw_user_meta_data->>'state_code' ~* '^[a-z]{2}$'
         THEN upper(NEW.raw_user_meta_data->>'state_code') END,
    CASE WHEN NEW.raw_user_meta_data->>'license_type' IN
           ('family_child_care', 'group_family_child_care', 'large_family_child_care', 'other')
         THEN (NEW.raw_user_meta_data->>'license_type')::public.famcomply_license_type END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.famcomply_subscriptions (user_id, plan_slug, status)
  VALUES (NEW.id, 'free', 'active'::public.famcomply_subscription_status)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'famcomply_handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS famcomply_on_auth_user_created ON auth.users;
CREATE TRIGGER famcomply_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.famcomply_handle_new_user();

-- ----------------------------------------------------------------------------
-- 7. updated_at TRIGGERS (every table)
-- ----------------------------------------------------------------------------
CREATE TRIGGER famcomply_profiles_touch
  BEFORE UPDATE ON public.famcomply_profiles
  FOR EACH ROW EXECUTE FUNCTION public.famcomply_update_updated_at();

CREATE TRIGGER famcomply_requirement_templates_touch
  BEFORE UPDATE ON public.famcomply_requirement_templates
  FOR EACH ROW EXECUTE FUNCTION public.famcomply_update_updated_at();

CREATE TRIGGER famcomply_provider_requirements_touch
  BEFORE UPDATE ON public.famcomply_provider_requirements
  FOR EACH ROW EXECUTE FUNCTION public.famcomply_update_updated_at();

CREATE TRIGGER famcomply_reminders_touch
  BEFORE UPDATE ON public.famcomply_reminders
  FOR EACH ROW EXECUTE FUNCTION public.famcomply_update_updated_at();

CREATE TRIGGER famcomply_plans_touch
  BEFORE UPDATE ON public.famcomply_plans
  FOR EACH ROW EXECUTE FUNCTION public.famcomply_update_updated_at();

CREATE TRIGGER famcomply_subscriptions_touch
  BEFORE UPDATE ON public.famcomply_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.famcomply_update_updated_at();

CREATE TRIGGER famcomply_payments_touch
  BEFORE UPDATE ON public.famcomply_payments
  FOR EACH ROW EXECUTE FUNCTION public.famcomply_update_updated_at();

CREATE TRIGGER famcomply_stripe_events_touch
  BEFORE UPDATE ON public.famcomply_stripe_events
  FOR EACH ROW EXECUTE FUNCTION public.famcomply_update_updated_at();

-- ----------------------------------------------------------------------------
-- 8. SEED DATA
-- ----------------------------------------------------------------------------

-- 8.1 Plans (free plan is the default; Stripe price ids set by the Deploy Mind)
INSERT INTO public.famcomply_plans
  (slug, name, description, price_monthly_cents, price_yearly_cents, features, allows_email_reminders, max_tracked_requirements, is_active, sort_order)
VALUES
  ('free', 'Free',
   'Your core renewal timeline with in-app reminders.',
   0, NULL,
   ARRAY[
     'Pre-built renewal timeline for your state and license',
     'All 6 core requirements in the right order',
     'In-app reminders on your dashboard'
   ],
   false, 6, true, 1),
  ('pro', 'Pro',
   'Email reminders and room to track everything, including local rules.',
   900, 7900,
   ARRAY[
     'Everything in Free',
     'Email reminders before every deadline',
     'Unlimited tracked requirements',
     'Custom requirements for county and city rules'
   ],
   true, NULL, true, 2)
ON CONFLICT (slug) DO NOTHING;

-- 8.2 Requirement templates: national baseline (state_code = ALL).
--     State-specific rows can be added later and automatically take priority.
--     sequence_order encodes the correct renewal sequence: certifications and
--     background checks come first because license renewal depends on them.
INSERT INTO public.famcomply_requirement_templates
  (state_code, license_type, requirement_kind, title, description, renewal_interval_months, sequence_order, lead_days, reminder_offsets_days)
VALUES
  ('ALL', NULL, 'cpr_certification', 'Pediatric CPR certification',
   'Renew your pediatric CPR certification. Most cards are valid for 2 years, and an expired card can hold up your license renewal.',
   24, 1, 60, '{60,30,14,7,1}'),
  ('ALL', NULL, 'first_aid_certification', 'Pediatric first aid certification',
   'Renew your pediatric first aid certification. Schedule it with your CPR class so both stay on the same clock.',
   24, 2, 60, '{60,30,14,7,1}'),
  ('ALL', NULL, 'background_check', 'Comprehensive background check',
   'Complete a new comprehensive background check for yourself and every adult in your home. Federal rules require one at least every 5 years.',
   60, 3, 90, '{90,60,30,14,7}'),
  ('ALL', NULL, 'continuing_education', 'Annual training hours',
   'Finish your required training hours before your renewal window opens. Hour counts vary by state, so confirm yours with your licensing agency.',
   12, 4, 90, '{90,60,30,14,7}'),
  ('ALL', NULL, 'inspection_prep', 'Home inspection prep',
   'Walk through your home before the licensing inspection: smoke and carbon monoxide detectors, fire extinguisher, exit routes, medication storage, and attendance records.',
   12, 5, 45, '{45,30,14,7,1}'),
  ('ALL', NULL, 'license_renewal', 'Family child care license renewal',
   'Submit your license renewal with current CPR, first aid, background checks, and training on file. Renewal cycles vary by state, so confirm your exact date with your licensing agency.',
   24, 6, 90, '{90,60,30,14,7,1}')
ON CONFLICT DO NOTHING;

-- fix QA-004
-- ============================================================================
-- QA-004 (security, high): billing tables must be read-only under RLS.
-- famcomply_subscriptions / famcomply_payments previously carried owner
-- FOR ALL policies (SELECT + INSERT + UPDATE + DELETE) and relied solely on
-- the famcomply_block_client_billing_writes trigger to stop self-upgrades;
-- a single dropped trigger would reopen the hole. The block below narrows
-- every policy on both tables to FOR SELECT only (preserving each policy's
-- original USING predicate and role list), so INSERT/UPDATE/DELETE fall back
-- to RLS default-deny. All legitimate billing writes come from the
-- service-role client (Stripe webhook / server code), which bypasses RLS.
-- The famcomply_block_client_billing_writes trigger is intentionally KEPT as
-- the second layer of defense.
-- ============================================================================

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT tablename, policyname, roles, qual, permissive
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('famcomply_subscriptions', 'famcomply_payments')
  LOOP
    -- Remove the over-broad policy (covers the owner FOR ALL policies).
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);

    -- Re-create it as read-only. Policies without a USING predicate
    -- (e.g. write-only WITH CHECK policies) are dropped outright.
    IF pol.qual IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS %s FOR SELECT TO %s USING (%s)',
        pol.policyname,
        pol.tablename,
        pol.permissive,
        array_to_string(pol.roles, ', '),
        pol.qual
      );
    END IF;
  END LOOP;

  -- Safety net: owners must always keep read access to their own rows so the
  -- billing page can render subscription + payment history.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'famcomply_subscriptions'
      AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY famcomply_subscriptions_owner_select
      ON public.famcomply_subscriptions
      FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'famcomply_payments'
      AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY famcomply_payments_owner_select
      ON public.famcomply_payments
      FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END;
$$;

-- Belt-and-braces: revoke write privileges from client roles at the GRANT
-- level so a future permissive policy alone cannot reopen client billing
-- writes. service_role keeps full access for webhook/server-driven writes.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON TABLE public.famcomply_subscriptions, public.famcomply_payments
  FROM anon, authenticated;


-- fix QA-015
-- QA-015: Align famcomply_reminder_channel enum with the honest data model in lib/db/types.ts.
-- REMINDER_CHANNELS is ['email'] because every reminder row written by
-- famcomply_sync_reminders is an email reminder, and free-plan "in-app reminders"
-- surface as dashboard status badges (computed), NOT as persisted reminder rows.
-- The 'in_app' enum value was dead (no code path ever writes it) and invited future
-- drift, so we remove it. Postgres cannot DROP a value from an enum in place, so we
-- recreate the type cleanly.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'famcomply_reminder_channel'
      AND e.enumlabel = 'in_app'
  ) THEN
    -- Recreate the enum without 'in_app'.
    ALTER TYPE famcomply_reminder_channel RENAME TO famcomply_reminder_channel_old;

    CREATE TYPE famcomply_reminder_channel AS ENUM ('email');

    -- Repoint the column. Any stray 'in_app' rows (there should be none) are
    -- normalized to 'email' before the cast so the migration is safe.
    UPDATE famcomply_reminders
    SET channel = 'email'
    WHERE channel::text = 'in_app';

    ALTER TABLE famcomply_reminders
      ALTER COLUMN channel DROP DEFAULT;

    ALTER TABLE famcomply_reminders
      ALTER COLUMN channel TYPE famcomply_reminder_channel
      USING (channel::text::famcomply_reminder_channel);

    ALTER TABLE famcomply_reminders
      ALTER COLUMN channel SET DEFAULT 'email';

    DROP TYPE famcomply_reminder_channel_old;
  END IF;
END $$;


-- fix QA-025
-- QA-025: app/api/plans/route.ts serves the public plan catalog with the anon
-- server client, but famcomply_plans only had a SELECT policy for the
-- authenticated role, so signed-out GET /api/plans returned an empty list.
-- Add an anon-role read policy on active plans so the public pricing endpoint
-- actually returns rows without service-role privileges.
DROP POLICY IF EXISTS famcomply_plans_anon_read ON public.famcomply_plans;
CREATE POLICY famcomply_plans_anon_read ON public.famcomply_plans
  FOR SELECT TO anon
  USING (is_active);


-- fix QA-033
-- ---------------------------------------------------------------------------
-- QA-033 fix: replace the non-IMMUTABLE expression unique index on
-- public.famcomply_requirement_templates.
--
-- The old index used COALESCE(license_type::text, 'all'); the enum->text cast
-- is only STABLE in Postgres, so CREATE INDEX raises 42P17 ('functions in
-- index expression must be marked IMMUTABLE') and the schema apply aborts.
-- Enforce the identical uniqueness semantics with two expression-free partial
-- unique indexes instead:
--   1. at most one template per (state_code, requirement_kind, license_type)
--      when a specific license type is set;
--   2. at most one catch-all template per (state_code, requirement_kind) when
--      license_type IS NULL (i.e. applies to all license types).
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS public.famcomply_requirement_templates_scope_key;

CREATE UNIQUE INDEX IF NOT EXISTS famcomply_requirement_templates_scope_typed_key
  ON public.famcomply_requirement_templates (state_code, requirement_kind, license_type)
  WHERE license_type IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS famcomply_requirement_templates_scope_all_key
  ON public.famcomply_requirement_templates (state_code, requirement_kind)
  WHERE license_type IS NULL;


-- fix QA-044
-- ============================================================
-- Fix QA-044 (supersedes QA-033): idempotent rebuild of the
-- requirement_templates uniqueness constraint.
--
-- ROOT CAUSE: Section 4 of the original schema created
--   CREATE UNIQUE INDEX famcomply_requirement_templates_scope_key
--     ON famcomply_requirement_templates (state, COALESCE(license_type::text, 'all'), requirement_key);
-- The COALESCE(...) expression is NOT IMMUTABLE in the index
-- context, so PostgreSQL raises 42P17 the moment section 4 runs
-- on a fresh Supabase project -- BEFORE any later "fix" block can
-- drop/replace it. The whole "executable top-to-bottom" apply
-- aborts.
--
-- We cannot edit the earlier section from an append-only block,
-- so instead of relying on a non-IMMUTABLE COALESCE we make the
-- table itself enforce uniqueness deterministically:
--   1. Backfill any NULL license_type to the sentinel 'all'.
--   2. Set a NOT NULL + DEFAULT so future inserts are stable.
--   3. Drop the offending expression index if it somehow exists.
--   4. Add a plain (state, license_type, requirement_key) unique
--      index -- all columns, no function calls, fully IMMUTABLE.
--
-- Every statement is guarded (IF EXISTS / DO block) so this file
-- is safe to run repeatedly.
-- ============================================================

DO $$
BEGIN
  -- Only act if the table actually exists (defensive on partial applies).
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'famcomply_requirement_templates'
  ) THEN

    -- 1. Normalize existing NULL license_type rows to the 'all' sentinel
    --    so the plain unique index below does not treat NULLs as distinct.
    EXECUTE $sql$
      UPDATE public.famcomply_requirement_templates
         SET license_type = 'all'
       WHERE license_type IS NULL
    $sql$;

    -- 2. Make license_type deterministic going forward.
    EXECUTE $sql$
      ALTER TABLE public.famcomply_requirement_templates
        ALTER COLUMN license_type SET DEFAULT 'all'
    $sql$;
    EXECUTE $sql$
      ALTER TABLE public.famcomply_requirement_templates
        ALTER COLUMN license_type SET NOT NULL
    $sql$;

  END IF;
END
$$;

-- 3. Remove the non-IMMUTABLE expression index if it was ever created.
--    (On a fresh apply it never gets created because section 4 aborts,
--    but on a partially-applied / previously-patched DB it may exist.)
DROP INDEX IF EXISTS public.famcomply_requirement_templates_scope_key;

-- 4. Recreate uniqueness using only bare columns -- fully IMMUTABLE,
--    no COALESCE, no 42P17. The 'all' sentinel (enforced above)
--    plays the role the COALESCE previously did.
CREATE UNIQUE INDEX IF NOT EXISTS famcomply_requirement_templates_scope_key
  ON public.famcomply_requirement_templates (state, license_type, requirement_key);