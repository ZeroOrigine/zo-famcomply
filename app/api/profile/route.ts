// CANONICAL: FamComply profile API.
// GET   /api/profile -> the caller's profile. Self-heals if the signup trigger
//                       ever missed a row, so the dashboard never sees a gap.
// PATCH /api/profile -> update name, state, license type, license number,
//                       timezone, or onboarding flag. State and license type
//                       drive timeline generation (POST /api/timeline).
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
import { LICENSE_TYPES, PROFILE_COLUMNS, US_STATE_CODES, type Profile } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const updateProfileSchema = z.object({
  full_name: z
    .string({ invalid_type_error: 'Your name needs to be text.' })
    .trim()
    .max(120, 'Keep your name under 120 characters.')
    .optional(),
  state_code: z
    .string({ invalid_type_error: 'Your state code needs to be text, like TX or OH.' })
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Use your 2 letter state code, like TX or OH.')
    .transform((value) => value.toUpperCase())
    .refine((value) => (US_STATE_CODES as readonly string[]).includes(value), {
      message: 'We could not match that state code. Use the 2 letter postal code, like CA or NY.',
    })
    .optional(),
  license_type: z
    .enum(LICENSE_TYPES, {
      errorMap: () => ({ message: `Pick one of these license types: ${LICENSE_TYPES.join(', ')}.` }),
    })
    .nullable()
    .optional(),
  license_number: z
    .string({ invalid_type_error: 'Your license number needs to be text.' })
    .trim()
    .max(60, 'License numbers can hold up to 60 characters.')
    .nullable()
    .optional(),
  timezone: z
    .string({ invalid_type_error: 'Your timezone needs to be text.' })
    .trim()
    .min(1, 'Add a timezone id like America/Chicago.')
    .max(60, 'That timezone id looks too long.')
    .refine(isValidTimezone, {
      message: 'That timezone id is not one we recognize. Use an IANA id like America/Chicago.',
    })
    .optional(),
  onboarding_completed: z
    .boolean({ invalid_type_error: 'onboarding_completed must be true or false.' })
    .optional(),
});

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const user = await requireUser(supabase);
    if (!user) {
      return unauthorizedError();
    }

    const { data: profile, error } = await supabase
      .from('famcomply_profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      return unexpectedError('GET /api/profile', error);
    }

    if (profile) {
      return apiSuccess(profile as Profile);
    }

    // Self-heal: the signup trigger normally creates this row. If it is missing,
    // create it now so the product keeps working.
    const metadataFullName =
      typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';

    const { data: createdProfile, error: insertError } = await supabase
      .from('famcomply_profiles')
      .insert({ id: user.id, email: user.email ?? null, full_name: metadataFullName })
      .select(PROFILE_COLUMNS)
      .single();

    if (insertError) {
      return unexpectedError('GET /api/profile (self-heal)', insertError);
    }

    return apiSuccess(createdProfile as Profile);
  } catch (error) {
    return unexpectedError('GET /api/profile', error);
  }
}

export async function PATCH(request: NextRequest) {
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

    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return zodValidationError(parsed.error);
    }

    const updatePayload: Record<string, string | boolean | null> = {};
    if (parsed.data.full_name !== undefined) updatePayload.full_name = parsed.data.full_name;
    if (parsed.data.state_code !== undefined) updatePayload.state_code = parsed.data.state_code;
    if (parsed.data.license_type !== undefined) updatePayload.license_type = parsed.data.license_type;
    if (parsed.data.license_number !== undefined) updatePayload.license_number = parsed.data.license_number;
    if (parsed.data.timezone !== undefined) updatePayload.timezone = parsed.data.timezone;
    if (parsed.data.onboarding_completed !== undefined) {
      updatePayload.onboarding_completed = parsed.data.onboarding_completed;
    }

    if (Object.keys(updatePayload).length === 0) {
      return apiError(
        'Nothing to update yet. Send at least one field, like state_code or license_type.',
        'EMPTY_UPDATE',
        400
      );
    }

    // Upsert so a missing profile row heals itself instead of failing the request.
    const { data: updatedProfile, error: upsertError } = await supabase
      .from('famcomply_profiles')
      .upsert({ id: user.id, email: user.email ?? null, ...updatePayload })
      .select(PROFILE_COLUMNS)
      .single();

    if (upsertError) {
      return unexpectedError('PATCH /api/profile', upsertError);
    }

    return apiSuccess(updatedProfile as Profile);
  } catch (error) {
    return unexpectedError('PATCH /api/profile', error);
  }
}
