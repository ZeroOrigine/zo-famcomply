// CANONICAL: FamComply single requirement API.
// GET    /api/requirements/[id] -> one requirement.
// PATCH  /api/requirements/[id] -> update dates, notes, or title. Marking a date
//                                  recomputes status and rebuilds reminders via triggers.
// DELETE /api/requirements/[id] -> remove a requirement (reminders cascade).
import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  apiError,
  apiSuccess,
  isoDateSchema,
  readJsonBody,
  requireUser,
  unauthorizedError,
  unexpectedError,
  zodValidationError,
} from '@/lib/db/api-helpers';
import { REQUIREMENT_COLUMNS, type ProviderRequirement } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const requirementIdentifierSchema = z.string().uuid();

const updateRequirementSchema = z
  .object({
    title: z
      .string({ invalid_type_error: 'The title needs to be text.' })
      .trim()
      .min(2, 'The title needs at least 2 characters.')
      .max(200, 'Keep the title under 200 characters.')
      .optional(),
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
  });

function invalidIdentifierResponse() {
  return apiError(
    'That requirement link looks off. Head back to your timeline and try again.',
    'INVALID_ID',
    400
  );
}

function notFoundResponse() {
  return apiError(
    "We couldn't find that requirement. It may have been removed.",
    'NOT_FOUND',
    404
  );
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const identifierResult = requirementIdentifierSchema.safeParse(params.id);
    if (!identifierResult.success) {
      return invalidIdentifierResponse();
    }

    const supabase = createSupabaseServerClient();
    const user = await requireUser(supabase);
    if (!user) {
      return unauthorizedError();
    }

    const { data: requirement, error } = await supabase
      .from('famcomply_provider_requirements')
      .select(REQUIREMENT_COLUMNS)
      .eq('id', identifierResult.data)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return unexpectedError('GET /api/requirements/[id]', error);
    }
    if (!requirement) {
      return notFoundResponse();
    }

    return apiSuccess(requirement as ProviderRequirement);
  } catch (error) {
    return unexpectedError('GET /api/requirements/[id]', error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const identifierResult = requirementIdentifierSchema.safeParse(params.id);
    if (!identifierResult.success) {
      return invalidIdentifierResponse();
    }

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

    const parsed = updateRequirementSchema.safeParse(body);
    if (!parsed.success) {
      return zodValidationError(parsed.error);
    }

    const { data: existingRequirement, error: fetchError } = await supabase
      .from('famcomply_provider_requirements')
      .select(REQUIREMENT_COLUMNS)
      .eq('id', identifierResult.data)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      return unexpectedError('PATCH /api/requirements/[id]', fetchError);
    }
    if (!existingRequirement) {
      return notFoundResponse();
    }

    const existing = existingRequirement as ProviderRequirement;

    const updatePayload: Record<string, string | number | null> = {};
    if (parsed.data.title !== undefined) updatePayload.title = parsed.data.title;
    if (parsed.data.issued_on !== undefined) updatePayload.issued_on = parsed.data.issued_on;
    if (parsed.data.expires_on !== undefined) updatePayload.expires_on = parsed.data.expires_on;
    if (parsed.data.completed_on !== undefined) updatePayload.completed_on = parsed.data.completed_on;
    if (parsed.data.notes !== undefined) updatePayload.notes = parsed.data.notes;
    if (parsed.data.lead_days !== undefined) updatePayload.lead_days = parsed.data.lead_days;
    if (parsed.data.sequence_order !== undefined) updatePayload.sequence_order = parsed.data.sequence_order;

    if (Object.keys(updatePayload).length === 0) {
      return apiError(
        'Nothing to update yet. Send at least one field, like expires_on or completed_on.',
        'EMPTY_UPDATE',
        400
      );
    }

    // Cross-check the dates as they will exist after the update.
    const nextIssuedOn =
      parsed.data.issued_on !== undefined ? parsed.data.issued_on : existing.issued_on;
    const nextExpiresOn =
      parsed.data.expires_on !== undefined ? parsed.data.expires_on : existing.expires_on;
    if (nextIssuedOn && nextExpiresOn && nextExpiresOn < nextIssuedOn) {
      return apiError(
        'The expiration date lands before the issue date. Mind checking those?',
        'VALIDATION_ERROR',
        400,
        { expires_on: ['The expiration date lands before the issue date. Mind checking those?'] }
      );
    }

    const { data: updatedRequirement, error: updateError } = await supabase
      .from('famcomply_provider_requirements')
      .update(updatePayload)
      .eq('id', identifierResult.data)
      .eq('user_id', user.id)
      .select(REQUIREMENT_COLUMNS)
      .single();

    if (updateError) {
      return unexpectedError('PATCH /api/requirements/[id]', updateError);
    }

    // Status and the reminder schedule are recomputed by database triggers.
    return apiSuccess(updatedRequirement as ProviderRequirement);
  } catch (error) {
    return unexpectedError('PATCH /api/requirements/[id]', error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const identifierResult = requirementIdentifierSchema.safeParse(params.id);
    if (!identifierResult.success) {
      return invalidIdentifierResponse();
    }

    const supabase = createSupabaseServerClient();
    const user = await requireUser(supabase);
    if (!user) {
      return unauthorizedError();
    }

    const { data: deletedRow, error } = await supabase
      .from('famcomply_provider_requirements')
      .delete()
      .eq('id', identifierResult.data)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      return unexpectedError('DELETE /api/requirements/[id]', error);
    }
    if (!deletedRow) {
      return notFoundResponse();
    }

    return apiSuccess({ id: (deletedRow as { id: string }).id, deleted: true });
  } catch (error) {
    return unexpectedError('DELETE /api/requirements/[id]', error);
  }
}
