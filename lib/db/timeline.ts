// CANONICAL: timeline read service for FamComply.
// API routes and server components both call this, so the sequenced timeline and
// its summary are computed in exactly one place. Services return data, never UI.
import type { SupabaseClient } from '@supabase/supabase-js';
import { REQUIREMENT_COLUMNS, type ProviderRequirement, type RequirementStatus } from '@/lib/db/types';
import { daysFromTodayUtc } from '@/lib/db/dates';

export interface TimelineNextDeadline {
  requirement_id: string;
  title: string;
  expires_on: string;
  days_until: number;
}

export interface TimelineSummary {
  total: number;
  completed: number;
  overdue: number;
  due_soon: number;
  on_track: number;
  not_started: number;
  next_deadline: TimelineNextDeadline | null;
}

export interface TimelineData {
  items: ProviderRequirement[];
  summary: TimelineSummary;
}

export interface TimelineResult {
  data: TimelineData | null;
  error: string | null;
}

export async function getTimeline(
  supabase: SupabaseClient,
  userId: string,
  limit = 100
): Promise<TimelineResult> {
  const boundedLimit = Math.min(Math.max(limit, 1), 100);

  const { data, error } = await supabase
    .from('famcomply_provider_requirements')
    .select(REQUIREMENT_COLUMNS)
    .eq('user_id', userId)
    .order('sequence_order', { ascending: true })
    .order('expires_on', { ascending: true, nullsFirst: false })
    .limit(boundedLimit);

  if (error) {
    return { data: null, error: error.message };
  }

  const items = (data ?? []) as ProviderRequirement[];
  return { data: { items, summary: buildSummary(items) }, error: null };
}

function buildSummary(items: ProviderRequirement[]): TimelineSummary {
  const counts: Record<RequirementStatus, number> = {
    not_started: 0,
    on_track: 0,
    due_soon: 0,
    overdue: 0,
    completed: 0,
  };

  let nextDeadline: TimelineNextDeadline | null = null;

  for (const item of items) {
    counts[item.status] += 1;

    if (item.completed_on === null && item.expires_on !== null) {
      if (nextDeadline === null || item.expires_on < nextDeadline.expires_on) {
        nextDeadline = {
          requirement_id: item.id,
          title: item.title,
          expires_on: item.expires_on,
          days_until: daysFromTodayUtc(item.expires_on),
        };
      }
    }
  }

  return {
    total: items.length,
    completed: counts.completed,
    overdue: counts.overdue,
    due_soon: counts.due_soon,
    on_track: counts.on_track,
    not_started: counts.not_started,
    next_deadline: nextDeadline,
  };
}
