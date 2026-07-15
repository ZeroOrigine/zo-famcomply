// CANONICAL: FamComply requirements collection API.
// GET  /api/requirements -> the caller's tracked requirements, paginated and filterable.
// POST /api/requirements -> add a custom requirement (county or city rules), with
//                           plan limits enforced server side from famcomply_plans.
// Auth, checkout, billing, and Stripe webhook routes live in the auth_payments step.
import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEntitlements } from '@/lib/db/entitlements';
import {
  apiError,
  apiSuccess,
  isoDateSchema,
  parsePagination,
  readJsonBody,
  requireUser,
  unauthorizedError,
  unexpectedError,
  zodValidationError,
} from '@/lib/db/api-helpers';
import {
  REQUIREMENT_COLUMNS,
  REQUIREMENT_KINDS,
  REQUIREMENT_STATUSES,
  type ProviderRequirement,
} from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const createRequirementSchema = z
  .object({
    title: z
      .string({
        required_error: 'Give this requirement a title so you can spot it on your timeline.',
        invalid_type_error: 'The title needs to be text.',
      })
      .trim()
      .min(2, 'The title needs at least 2 characters.')
      .max(200, 'Keep the title under 200 characters.'),
    requirement_kind: z.enum(REQUIREMENT_KINDS, {
      errorMap: () => ({
        message: `Pick one of these requirement types: ${REQUIREMENT_KINDS.join(', ')}.`,
      }),
    }),
    issued_on: isoDateSchema.nullable().optional(),
    expires_on: isoDateSchema.nullable().optional(),
    completed_on: isoDateSchema.nullable().optional(),
    notes: z
      .string({ invalid_type_error: 'Notes need to be text.' })
      .max(2000, 'Notes can hold up to 2000 characters.')
      .optional(),
    lead_days: z
      .number({ invalid_type_error: 'Lead days must be a number.' })
      .int('Lead days must be a whole number.')
      .min(0, 'Lead days cannot be negative.')
      .max(365, 'Lead days can be at most 365.')
      .optional(),
    sequence_order: z
      .number({ invalid_type_error: 'Sequence order must be a number.' })
      .int('Sequence order must be a whole number.')
      .min(0, 'Sequence order cannot be negative.')
      .max(1000, 'Sequence order can be at most 1000.')
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.issued_on && value.expires_on && value.expires_on < value.issued_on) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expires_on'],
        message: 'The expiration date lands before the issue date. Mind checking those?',
      });
    }
  });

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const user = await requireUser(supabase);
    if (!user) {
      return unauthorizedError();
    }

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);

    const statusFilter = searchParams.get('status');
    if (statusFilter !== null && !(REQUIREMENT_STATUSES as readonly string[]).includes(statusFilter)) {
      return apiError(
        `That status filter is not one we know. Use one of: ${REQUIREMENT_STATUSES.join(', ')}.`,
        'INVALID_FILTER',
        400
      );
    }

    const kindFilter = searchParams.get('kind');
    if (kindFilter !== null && !(REQUIREMENT_KINDS as readonly string[]).includes(kindFilter)) {
      return apiError(
        `That requirement type is not one we track. Use one of: ${REQUIREMENT_KINDS.join(', ')}.`,
        'INVALID_FILTER',
        400
      );
    }

    // Uses famcomply_provider_requirements_user_idx (and the user+status index when filtered).
    let query = supabase
      .from('famcomply_provider_requirements')
      .select(REQUIREMENT_COLUMNS, { count: 'exact' })
      .eq('user_id', user.id);

    if (statusFilter !== null) {
      query = query.eq('status', statusFilter);
    }
    if (kindFilter !== null) {
      query = query.eq('requirement_kind', kindFilter);
    }

    const { data, error, count } = await query
      .order('sequence_order', { ascending: true })
      .order('expires_on', { ascending: true, nullsFirst: false })
      .range(pagination.from, pagination.to);

    if (error) {
      return unexpectedError('GET /api/requirements', error);
    }

    const total = count ?? 0;
    return apiSuccess((data ?? []) as ProviderRequirement[], 200, {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    });
  } catch (error) {
    return unexpectedError('GET /api/requirements', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const user = await requireUser(supabase);
    if (!user) {
      return unauthorizedError();
    }

    const body = await readJsonBody(request);
    if (body === undefined) {
      return apiError(
        'We could not read that request. Send a JSON object in the body.',
        'INVALID_JSON',
        400
      );
    }

    const parsed = createRequirementSchema.safeParse(body);
    if (!parsed.success) {
      return zodValidationError(parsed.error);
    }

    // Plan limit check. famcomply_plans is the source of truth for entitlements.
    const entitlements = await getEntitlements(supabase, user.id);
    if (entitlements.maxTrackedRequirements !== null) {
      const { count: trackedCount, error: countError } = await supabase
        .from('famcomply_provider_requirements')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) {
        return unexpectedError('POST /api/requirements (count)', countError);
      }

      if ((trackedCount ?? 0) >= entitlements.maxTrackedRequirements) {
        return apiError(
          `Your ${entitlements.planName} plan tracks up to ${entitlements.maxTrackedRequirements} requirements. Upgrade to Pro for unlimited tracking and custom local rules.`,
          'PLAN_LIMIT_REACHED',
          403
        );
      }
    }

    const insertPayload = {
      user_id: user.id,
      product_id: 'famcomply',
      template_id: null,
      requirement_kind: parsed.data.requirement_kind,
      title: parsed.data.title,
      issued_on: parsed.data.issued_on ?? null,
      expires_on: parsed.data.expires_on ?? null,
      completed_on: parsed.data.completed_on ?? null,
      notes: parsed.data.notes ?? '',
      lead_days: parsed.data.lead_days ?? 60,
      // Custom requirements default to the end of the sequence, after the 6 core items.
      sequence_order: parsed.data.sequence_order ?? 99,
    };

    const { data: createdRequirement, error: insertError } = await supabase
      .from('famcomply_provider_requirements')
      .insert(insertPayload)
      .select(REQUIREMENT_COLUMNS)
      .single();

    if (insertError) {
      return unexpectedError('POST /api/requirements', insertError);
    }

    // Database triggers derive the status and build the reminder schedule automatically.
    return apiSuccess(createdRequirement as ProviderRequirement, 201);
  } catch (error) {
    return unexpectedError('POST /api/requirements', error);
  }
}
