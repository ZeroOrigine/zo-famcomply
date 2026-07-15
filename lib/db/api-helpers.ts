// CANONICAL: shared HTTP plumbing for every FamComply API route.
// One response envelope everywhere:
//   success -> { data, error: null, status, meta? }
//   failure -> { data: null, error: <human message>, code, status, fields? }
import { NextResponse } from 'next/server';
import { z, type ZodError } from 'zod';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { isValidCalendarDate } from '@/lib/db/dates';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  from: number;
  to: number;
}

export function apiSuccess<T>(data: T, status = 200, meta?: PaginationMeta): NextResponse {
  const body =
    meta === undefined
      ? { data, error: null, status }
      : { data, error: null, status, meta };
  return NextResponse.json(body, { status });
}

export function apiError(
  message: string,
  code: string,
  status: number,
  fields?: Record<string, string[]>
): NextResponse {
  const body =
    fields === undefined
      ? { data: null, error: message, code, status }
      : { data: null, error: message, code, status, fields };
  return NextResponse.json(body, { status });
}

export function unauthorizedError(): NextResponse {
  return apiError(
    'Please sign in to keep going. Your session may have timed out.',
    'UNAUTHORIZED',
    401
  );
}

// Logs the real error server side and returns a calm, human message.
// Internal details never reach the client.
export function unexpectedError(context: string, error: unknown): NextResponse {
  console.error(`[famcomply] Unexpected error in ${context}:`, error);
  return apiError(
    'Our side hit a snag just now. Please try again in a moment.',
    'INTERNAL_ERROR',
    500
  );
}

// Secure session check: auth.getUser() validates the JWT with the auth server.
export async function requireUser(supabase: SupabaseClient): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error !== null) {
    return null;
  }
  return data.user;
}

// Every list endpoint paginates: default 20 per page, hard max 100.
export function parsePagination(
  searchParams: URLSearchParams,
  defaultLimit = 20,
  maxLimit = 100
): PaginationParams {
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const rawLimit = Number.parseInt(searchParams.get('limit') ?? String(defaultLimit), 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
  const from = (page - 1) * limit;

  return { page, limit, from, to: from + limit - 1 };
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function firstIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? 'Please double check the highlighted fields.';
}

function fieldErrors(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : 'body';
    if (fields[key] === undefined) {
      fields[key] = [];
    }
    fields[key].push(issue.message);
  }
  return fields;
}

export function zodValidationError(error: ZodError): NextResponse {
  return apiError(firstIssueMessage(error), 'VALIDATION_ERROR', 400, fieldErrors(error));
}

// Shared date field schema with human error messages.
export const isoDateSchema = z
  .string({
    required_error: 'Add a date in YYYY-MM-DD format.',
    invalid_type_error: 'Dates need to be text in YYYY-MM-DD format.',
  })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD, like 2026-09-01.')
  .refine(isValidCalendarDate, {
    message: 'That day does not exist on the calendar. Mind checking it?',
  });

// PostgREST returns embedded to-one relations as an object, but some client
// versions type them as arrays. Normalize once here so routes stay clean.
export function normalizeEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
