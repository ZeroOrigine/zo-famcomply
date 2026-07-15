// CANONICAL: FamComply plans API.
// GET /api/plans -> active plans in display order. Public pricing reference data,
// read with the anon server client under an anon-role RLS SELECT policy
// (famcomply_plans FOR SELECT TO anon USING (is_active)) so a public,
// unauthenticated endpoint never runs with service-role privileges. Read only.
// The service role is reserved for cron and webhook paths.
// Checkout and billing routes live in the auth_payments step.
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { apiSuccess, parsePagination, unexpectedError } from '@/lib/db/api-helpers';
import { PLAN_COLUMNS, type Plan } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);

    const supabase = createSupabaseServerClient();
    const { data, error, count } = await supabase
      .from('famcomply_plans')
      .select(PLAN_COLUMNS, { count: 'exact' })
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .range(pagination.from, pagination.to);

    if (error) {
      return unexpectedError('GET /api/plans', error);
    }

    const total = count ?? 0;
    return apiSuccess((data ?? []) as Plan[], 200, {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    });
  } catch (error) {
    return unexpectedError('GET /api/plans', error);
  }
}
