// CANONICAL: FamComply reminders list API.
// GET /api/reminders -> the caller's reminder schedule, paginated, filterable by
//                       status (default: pending) and by an upcoming window in days.
// Reminder rows are created automatically by database triggers when expiry dates change.
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  apiError,
  apiSuccess,
  normalizeEmbedded,
  parsePagination,
  requireUser,
  unauthorizedError,
  unexpectedError,
} from '@/lib/db/api-helpers';
import { addDaysToTodayUtc, todayUtcIsoDate } from '@/lib/db/dates';
import {
  REMINDER_STATUSES,
  type ReminderChannel,
  type ReminderRequirementSummary,
  type ReminderStatus,
  type ReminderWithRequirement,
} from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const REMINDER_LIST_COLUMNS =
  'id, requirement_id, remind_on, channel, status, sent_at, created_at, requirement:famcomply_provider_requirements(id, title, requirement_kind, expires_on, status)';

interface RawReminderRow {
  id: string;
  requirement_id: string;
  remind_on: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  sent_at: string | null;
  created_at: string;
  requirement: ReminderRequirementSummary | ReminderRequirementSummary[] | null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const user = await requireUser(supabase);
    if (!user) {
      return unauthorizedError();
    }

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);

    const statusParameter = searchParams.get('status') ?? 'pending';
    const validStatusFilters: string[] = [...REMINDER_STATUSES, 'all'];
    if (!validStatusFilters.includes(statusParameter)) {
      return apiError(
        `That status filter is not one we know. Use one of: ${validStatusFilters.join(', ')}.`,
        'INVALID_FILTER',
        400
      );
    }

    const withinDaysParameter = searchParams.get('within_days');
    let withinDays: number | null = null;
    if (withinDaysParameter !== null) {
      const parsedDays = Number.parseInt(withinDaysParameter, 10);
      if (!Number.isFinite(parsedDays) || parsedDays < 1 || parsedDays > 365) {
        return apiError(
          'within_days needs to be a whole number between 1 and 365.',
          'INVALID_FILTER',
          400
        );
      }
      withinDays = parsedDays;
    }

    let query = supabase
      .from('famcomply_reminders')
      .select(REMINDER_LIST_COLUMNS, { count: 'exact' })
      .eq('user_id', user.id);

    if (statusParameter !== 'all') {
      query = query.eq('status', statusParameter);
    }
    if (withinDays !== null) {
      query = query.gte('remind_on', todayUtcIsoDate()).lte('remind_on', addDaysToTodayUtc(withinDays));
    }

    const { data, error, count } = await query
      .order('remind_on', { ascending: true })
      .range(pagination.from, pagination.to);

    if (error) {
      return unexpectedError('GET /api/reminders', error);
    }

    const reminders: ReminderWithRequirement[] = ((data ?? []) as unknown as RawReminderRow[]).map(
      (row) => ({
        id: row.id,
        requirement_id: row.requirement_id,
        remind_on: row.remind_on,
        channel: row.channel,
        status: row.status,
        sent_at: row.sent_at,
        created_at: row.created_at,
        requirement: normalizeEmbedded(row.requirement),
      })
    );

    const total = count ?? 0;
    return apiSuccess(reminders, 200, {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    });
  } catch (error) {
    return unexpectedError('GET /api/reminders', error);
  }
}
