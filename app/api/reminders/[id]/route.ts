// CANONICAL: FamComply single reminder API.
// PATCH /api/reminders/[id] -> cancel a pending reminder. Everything else about
// reminders is automatic, so cancel is the only manual action a provider needs.
import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  apiError,
  apiSuccess,
  readJsonBody,
  requireUser,
  unauthorizedError,
  unexpectedError,
  zodValidationError,
} from '@/lib/db/api-helpers';
import { REMINDER_COLUMNS, type Reminder } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const reminderIdentifierSchema = z.string().uuid();

const cancelReminderSchema = z.object({
  status: z.literal('canceled', {
    errorMap: () => ({
      message: "Reminders can only be set to 'canceled'. Everything else is automatic.",
    }),
  }),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const identifierResult = reminderIdentifierSchema.safeParse(params.id);
    if (!identifierResult.success) {
      return apiError(
        'That reminder link looks off. Head back to your reminders and try again.',
        'INVALID_ID',
        400
      );
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

    const parsed = cancelReminderSchema.safeParse(body);
    if (!parsed.success) {
      return zodValidationError(parsed.error);
    }

    const { data: existingReminder, error: fetchError } = await supabase
      .from('famcomply_reminders')
      .select('id, status')
      .eq('id', identifierResult.data)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      return unexpectedError('PATCH /api/reminders/[id]', fetchError);
    }
    if (!existingReminder) {
      return apiError(
        "We couldn't find that reminder. It may have already been cleaned up.",
        'NOT_FOUND',
        404
      );
    }

    const existingStatus = (existingReminder as { id: string; status: string }).status;
    if (existingStatus !== 'pending') {
      return apiError(
        `This reminder is already ${existingStatus}. Only pending reminders can be canceled.`,
        'REMINDER_NOT_PENDING',
        409
      );
    }

    const { data: updatedReminder, error: updateError } = await supabase
      .from('famcomply_reminders')
      .update({ status: 'canceled' })
      .eq('id', identifierResult.data)
      .eq('user_id', user.id)
      .select(REMINDER_COLUMNS)
      .single();

    if (updateError) {
      return unexpectedError('PATCH /api/reminders/[id]', updateError);
    }

    return apiSuccess(updatedReminder as Reminder);
  } catch (error) {
    return unexpectedError('PATCH /api/reminders/[id]', error);
  }
}
