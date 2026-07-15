// CANONICAL: FamComply timeline API. This is the product's core move.
// POST /api/timeline -> build the sequenced renewal timeline from the caller's
//                       state and license type, using curated templates.
// GET  /api/timeline -> the timeline in renewal order plus a status summary.
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getTimeline } from '@/lib/db/timeline';
import {
  apiError,
  apiSuccess,
  requireUser,
  unauthorizedError,
  unexpectedError,
} from '@/lib/db/api-helpers';
import type { ProviderRequirement } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

type GeneratedTimelineRow = ProviderRequirement & { user_id: string; product_id: string };

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const user = await requireUser(supabase);
    if (!user) {
      return unauthorizedError();
    }

    const { searchParams } = new URL(request.url);
    const limitParameter = Number.parseInt(searchParams.get('limit') ?? '100', 10);
    const limit =
      Number.isFinite(limitParameter) && limitParameter > 0 ? Math.min(limitParameter, 100) : 100;

    const timeline = await getTimeline(supabase, user.id, limit);
    if (timeline.error !== null || timeline.data === null) {
      return unexpectedError('GET /api/timeline', timeline.error);
    }

    return apiSuccess(timeline.data);
  } catch (error) {
    return unexpectedError('GET /api/timeline', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const user = await requireUser(supabase);
    if (!user) {
      return unauthorizedError();
    }

    // The database function reads the caller's profile (state + license type),
    // prefers state-specific templates over the national baseline, and skips
    // any requirement kind the user already tracks.
    const { data, error } = await supabase.rpc('famcomply_generate_timeline');

    if (error) {
      if (error.message.toLowerCase().includes('add your state')) {
        return apiError(
          'Add your state to your profile first, then we can build your timeline.',
          'PROFILE_INCOMPLETE',
          400
        );
      }
      return unexpectedError('POST /api/timeline', error);
    }

    const generatedRows = (data ?? []) as GeneratedTimelineRow[];
    const created: ProviderRequirement[] = generatedRows.map((row) => ({
      id: row.id,
      template_id: row.template_id,
      requirement_kind: row.requirement_kind,
      title: row.title,
      issued_on: row.issued_on,
      expires_on: row.expires_on,
      completed_on: row.completed_on,
      status: row.status,
      sequence_order: row.sequence_order,
      lead_days: row.lead_days,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
    created.sort((a, b) => a.sequence_order - b.sequence_order);

    if (created.length === 0) {
      return apiSuccess({
        created: [],
        created_count: 0,
        message: 'Your timeline already covers every core requirement for your state. Nothing new was added.',
      });
    }

    const requirementPhrase = created.length === 1 ? 'requirement is' : 'requirements are';
    return apiSuccess(
      {
        created,
        created_count: created.length,
        message: `Your timeline is ready. ${created.length} ${requirementPhrase} now tracked in the right order. Add each expiration date and reminders take care of themselves.`,
      },
      201
    );
  } catch (error) {
    return unexpectedError('POST /api/timeline', error);
  }
}
